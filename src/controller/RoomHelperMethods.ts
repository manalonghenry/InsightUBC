import {
	ApplyRule,
	Course,
	Filter,
	LogicComparison,
	Negation,
	Query,
	QueryOptions,
	QueryTransformations,
	Room,
	SComparison, SortOptions
} from "./QueryInterfaces";
import {InsightError, InsightResult, ResultTooLargeError} from "./IInsightFacade";
import {QueryHelperMethods} from "./QueryHelperMethods";
import Decimal from "decimal.js";

export class RoomHelperMethods{
	// public rooms: Room[] = [];
	public applyKeys: string[] = [];
	public isRoomsQuery = false;
	public datasetName: string = "";
	public isRoomQuery(query: Query): boolean{ // Returns true if query should be treated as a Rooms query
		if("TRANSFORMATIONS" in query){
			return true;
		}
		const {WHERE, OPTIONS} = query as Query;
		if("SORT" in OPTIONS){
			return true;
		}
		let {COLUMNS} = OPTIONS as QueryOptions;
		for(let str of COLUMNS){
			let temp = str.split("_")[1];
			if(temp === "lat" || temp === "lon" || temp === "seats" ||
				temp === "fullname" || temp === "shortname" || temp === "number" ||
				temp === "name" || temp === "address"){
				return true;
			}
		}
		return false;
	}

	public isValidRoomMField(mfield: string): boolean{
		return mfield === "lat" || mfield === "lon" || mfield === "seats" || mfield === "avg" ||
			mfield === "pass" || mfield === "fail" || mfield === "audit" || mfield === "year";
	}

	public isValidRoomSField(sfield: string): boolean{
		return sfield === "fullname" || sfield === "shortname" || sfield === "number" || sfield === "name" ||
			sfield === "address" || sfield === "type" || sfield === "furniture" || sfield === "href" ||
			sfield === "dept" || sfield === "id" || sfield === "instructor" || sfield === "title" ||
			sfield === "uuid";
	}

	public keyInColumnsValid(transformations: QueryTransformations, options: QueryOptions): void {
		for(let column of options.COLUMNS){
			if(!this.applyKeys.includes(column) && !transformations.GROUP.includes(column)){
				throw new InsightError("Key from Column needs to be in group/apply");
			}
		}
	}

	public groupBy(transformation: QueryTransformations, toBeTraversed: any[]): [any[], any[]]{ // Array of [any[], any[]]
		const groupCriteria = transformation.GROUP;
		const groups: {[key: string]: any[]} = {};
		const fullGroup: string[] = [];
		for(let element of groupCriteria){
			fullGroup.push(element.split("_")[1]);
			this.datasetName = element.split("_")[0];
		}
		toBeTraversed.forEach((courseOrRoom) => {
			const groupKey = fullGroup.map((criteria) => courseOrRoom[criteria]).join("|"); // Generating group key
			if (!groups[groupKey]) { // Creating group if not exists
				groups[groupKey] = [];
			}
			groups[groupKey].push(courseOrRoom); // Adding course to the respective group
		});
		const resultGroups = Object.values(groups); // Converting groups object to array
		return [resultGroups, Object.keys(groups)]; // Returning the grouped data and group keys
	}

	public applyOnGroups(groups: [any[], any[]], appRuleList: ApplyRule[], transformation: QueryTransformations): any[]{
		let apply: any[] = [];
		Array.prototype.forEach.call(groups[0], (group) => {
			let groupings: any = {};
			Array.prototype.forEach.call(appRuleList, (rule) => {
				const applyKey = Object.keys(rule)[0];
				const token = Object.keys(rule[applyKey])[0];
				const k = rule[applyKey][token];
				if(k === ""){
					throw new InsightError("Key is empty");
				}
				// if(applyKey.includes("_")){
				// 	throw new InsightError("Apply Key is not allowed to have an underscore");
				// }
				// this.applyKeys.push(applyKey);
				if (token === "AVG" && this.numericKey(k.split("_")[1])) {
					groupings[applyKey] = this.applyAVG(group, rule);
				} else if (token === "MIN" && this.numericKey(k.split("_")[1])) {
					groupings[applyKey] = this.applyMIN(group, rule);
				}else if(token === "MAX" && this.numericKey(k.split("_")[1])){
					groupings[applyKey] = this.applyMAX(group, rule);
				}else if(token === "COUNT"){
					groupings[applyKey] = this.applyCOUNT(group, rule);
				}else if(token === "SUM" && this.numericKey(k.split("_")[1])){
					groupings[applyKey] = this.applySUM(group, rule);
				}else{
					throw new InsightError("Not an applicable applyToken");
				}
			});
			apply.push([groupings]);
		});
		let groupList = transformation.GROUP;
		let data: any[] = [];
		for(let string of groups[1]){
			let innerObj: InsightResult = {};
			let seperatedString = (string as string).split("|");
			let index = 0;
			for(let contents of seperatedString){
				innerObj[groupList[index]] = contents;
				index++;
			}
			data.push(innerObj);
		}
		apply.push(data);
		return apply;
	}

	private applyAVG(group: any, rule: ApplyRule): number{
		const applyKey = Object.keys(rule)[0];
		const token = Object.keys(rule[applyKey])[0];
		const key = rule[applyKey][token];
		let k: string = key.split("_")[1];
		let sum = new Decimal(0);
		Array.prototype.forEach.call(group, (item) => {
			sum = sum.plus(new Decimal(item[k]));
		});
		return Number((sum.toNumber() / group.length).toFixed(2));
	}

	private applyMIN(group: any, rule: ApplyRule): number{
		const applyKey = Object.keys(rule)[0];
		const token = Object.keys(rule[applyKey])[0];
		const key = rule[applyKey][token];
		let k: string = key.split("_")[1];
		let min = group[0][k];
		Array.prototype.forEach.call(group, (item) => {
			if (item[k] < min) {
				min = item[k];
			}
		});
		return min;
	}

	public applyMAX(group: any, rule: ApplyRule): number{
		const applyKey = Object.keys(rule)[0];
		const token = Object.keys(rule[applyKey])[0];
		const key = rule[applyKey][token];
		let k: string = key.split("_")[1];
		let max = group[0][k];
		Array.prototype.forEach.call(group,(item) => {
			if(item[k] > max){
				max = item[k];
			}
		});
		return max;
	}

	public applyCOUNT(group: any, rule: ApplyRule): number {
		const applyKey = Object.keys(rule)[0];
		const token = Object.keys(rule[applyKey])[0];
		const key = rule[applyKey][token];
		let k: string = key.split("_")[1];
		let uniqueValues = new Set();
		Array.prototype.forEach.call(group, (item) => {
			uniqueValues.add(item[k]);
		});
		return uniqueValues.size;
	}

	public applySUM(group: any, rule: ApplyRule): number{
		const applyKey = Object.keys(rule)[0];
		const token = Object.keys(rule[applyKey])[0];
		const key = rule[applyKey][token];
		let k: string = key.split("_")[1];
		let sum = new Decimal(0);
		Array.prototype.forEach.call(group, (item) => {
			sum = sum.add(item[k]);
		});
		return Number(sum.toFixed(2));

	}

	public formatGroups(apply: any[],  results: InsightResult[], groups: any,
		transformations: QueryTransformations, options: QueryOptions){
		let index = 0;
		for(let element of groups){
			let colResult: InsightResult = {};
			// let left = element.split(":")[0];
			// colResult[left] = element.split(":")[1].trim();
			for(let k in element){
				if(options.COLUMNS.includes(k)){
					let temp = element[k];
					let temp2 = k.split("_")[1];
					if(this.isValidRoomMField(temp2)){
						temp = parseFloat(temp);
					}else if(temp2 === "id" || temp2 === "year" || temp2 === "avg" || temp2 === "pass" ||
						temp2 === "fail" || temp2 === "audit") {
						temp = parseInt(temp, 10);
					}
					colResult[k] =  element[k];
				}
			}
			if((transformations.APPLY as ApplyRule[]).length > 0){
				let keys = apply[index];
				for(let key of keys){
					for(let data in key){
						if(options.COLUMNS.includes(data)) {
							colResult[data] = key[data];
						}
					}
				}
			}
			let newRet: InsightResult = {};
			for(let column of options.COLUMNS) {
				Object.keys(colResult).forEach((k) => {
					if(column === k){
						newRet[k] = colResult[k];
					}
				});
			}
			index++;
			results.push(newRet);
		}
	}

	public numericKey(key: any): boolean{
		return key !== "dept" && key !== "id" && key !== "instructor" && key !== "uuid" && key !== "title" &&
			key !== "shortname" && key !== "fullname" && key !== "name" && key !== "number" &&
			key !== "address" && key !== "type" && key !== "furniture" && key !== "href";
	}

	public isValidApplyKey(applyRuleList: ApplyRule[]){
		Array.prototype.forEach.call(applyRuleList, (rule) =>{
			const applyKey = Object.keys(rule)[0];
			// const token = Object.keys(rule[applyKey])[0];
			// if(applyKey.includes("_") || this.applyKeys.includes(applyKey)){
			// 	throw new InsightError("Apply Key is not allowed to have an underscore and/or is a duplicate");
			// }else{
			// 	this.applyKeys.push(applyKey);
			// }
			if(!applyKey.includes("_") && !this.applyKeys.includes(applyKey)){
				this.applyKeys.push(applyKey);
			}else{
				throw new InsightError("Apply key is not allowed to have an underscore and/or is a duplicate");
			}
		});
	}
}
