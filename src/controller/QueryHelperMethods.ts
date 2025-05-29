import {
	Course, Filter, LogicComparison, Negation, QueryTransformations, Room, SComparison,
	SortOptions, Direction, QueryOptions
} from "./QueryInterfaces";
import {InsightError, ResultTooLargeError} from "./IInsightFacade";
import fs from "fs-extra";
import InsightFacade from "./InsightFacade";
import {RoomHelperMethods} from "./RoomHelperMethods";

export class QueryHelperMethods {
	public courses: any[] = [];
	public validCoursesOrRooms: any[] = [];
	public datasetName: string = "";

	public roomHelper = new RoomHelperMethods();


	public filterCourses(filter: Filter): Course[]{
		try{
			this.validCoursesOrRooms = this.courses.filter((course) => this.logicFilter(course, filter));
			return this.validCoursesOrRooms;
		} catch(err){
			throw new InsightError(`Filter ${err}`);
		}
	}

	public filterQuery(filter: Filter, course: Course | Room): boolean {
		let ret = false;
		if (Object.prototype.hasOwnProperty.call(filter, "IS")) { // String comparison
			return this.scomparatorFilterQuery(filter, course);
		}
		if (Object.prototype.hasOwnProperty.call(filter, "GT") ||
			Object.prototype.hasOwnProperty.call(filter, "LT") ||
			Object.prototype.hasOwnProperty.call(filter, "EQ")) { // Math
			ret = this.mcomparatorFilterQuery(filter, course);

		}
		if (Object.prototype.hasOwnProperty.call(filter, "OR") || Object.prototype.hasOwnProperty.call(filter, "AND")) {
			ret = this.logicFilter(course, filter);
		}
		return ret;
	}

	private scomparatorFilterQuery(filter: Filter, course: Course | Room): boolean {
		const SComparator = Object.keys(filter)[0];
		const contents = Object.values(filter)[0];
		const idString = Object.keys(contents)[0].split("_")[0];
		const sfield = Object.keys(contents)[0].split("_")[1];
		const inputString = Object.values(contents)[0];
		if(typeof inputString !== "string") {
			throw new InsightError("inputString is not a string");
		}
		let ret = false;
		this.setDatasetName(idString);
		if (sfield !== "title" && sfield !== "uuid" &&
			sfield !== "instructor" && sfield !== "id" &&
			sfield !== "dept") {
			if(!this.roomHelper.isRoomsQuery || !this.roomHelper.isValidRoomSField(sfield)){
				throw new InsightError("sfield is not valid: " + sfield);
			}
		}
		if((inputString as string).includes("*")) {
			return this.validateWildcards(inputString as string, sfield, SComparator, course);
		}else{
			if (SComparator === "IS") {
				ret = (course[sfield] === inputString);
			} else {
				throw new InsightError("wrong SComparator");
			}
		}
		return ret;
	}

	private validateWildcards (inputString: string, sfield: string, SComparator: string, c: Course | Room): boolean {
		const validate: string[] = inputString.split("*");
		const count = inputString.split("*").length - 1;
		if(count > 2) {
			throw new InsightError("Contains more than 2 * (can contain at most 2)");
		} else if(count === 2){
			let regexBoth = /^\*[^*]+\*$/;
			if(validate[0].length === 0 && validate[1].length === 0 && validate[2].length === 0) {
				throw new ResultTooLargeError();
			}
			if(regexBoth.test(inputString)){
				return this.performWildcards(sfield, inputString, SComparator, 1, c);
			}else{
				throw new InsightError("Does not conform to a valid Wildcards format");
			}
		}else if(count === 1){
			let regexStart = /^\*[^*]+$/;
			let regexEnd = /^[^*]+\*$/;
			if(validate[0].length === 0 && validate[1].length === 0){
				throw new ResultTooLargeError();
			}
			if(regexStart.test(inputString)){
				return this.performWildcards(sfield, inputString, SComparator, 2, c);
			} else if(regexEnd.test(inputString)){
				return this.performWildcards(sfield, inputString, SComparator, 3, c);
			}else {
				throw new InsightError("Does not conform to a valid Wildcards format");
			}
		}else{
			throw new InsightError("Doesn't contain *?????");
		}
	}

	private performWildcards(sfield: string, IS: string, SComparator: string, num: number, c: Course | Room): boolean {
		let ret: boolean = false;
		IS = IS.replace(/\*/g, "").trim();
		let lengthIS = IS.length;
		if (SComparator === "IS") {
			let temp: string = String(c[sfield]);
			if (num === 1 && (temp).includes(IS)) {
				ret = true;
			}else if(num === 2) {
				let lengthSField = temp.length;
				ret = temp.substring((lengthSField - lengthIS)) === IS;
			}else{
				ret = (temp.substring(0,lengthIS) === IS);
			}

			return ret;
		} else {
			throw new InsightError("wrong SComparator");
		}
	}


	private mcomparatorFilterQuery(filter: Filter, course: Course | Room): boolean {
		if(this.checkMComparatorValidity(filter)){
			const MComparator = Object.keys(filter)[0];
			const contents = Object.values(filter)[0];
			const idString = Object.keys(contents)[0].split("_")[0];
			const mfield = Object.keys(contents)[0].split("_")[1];
			const value = Object.values(contents)[0];
			if(typeof value === "string"){
				throw new InsightError("value is a string");
			}
			let ret = false;
			this.setDatasetName(idString);
			if (mfield !== "id" && mfield !== "year" && mfield !== "avg" &&
				mfield !== "pass" && mfield !== "fail" && mfield !== "audit") {
				if(!this.roomHelper.isRoomsQuery || !this.roomHelper.isValidRoomMField(mfield)){ // if not a room query or if not a valid mfield for room query
					throw new InsightError("mfield is not valid: " + mfield); // Throw error
				}
			}
			if (MComparator === "GT") {
				ret = course[mfield] > (value as number);
			} else if (MComparator === "LT") {
				ret = course[mfield] < (value as number);
			} else if (MComparator === "EQ") {
				ret = course[mfield] === (value as number);
			} else {
				throw new InsightError("wrong MComparator");
			}
			return ret;
		}
		throw new InsightError("Something went wrong in MComparator");
	}

	private checkMComparatorValidity(filter: Filter): boolean {
		try{
			const MComparator = Object.keys(filter)[0];
			const contents = Object.values(filter)[0];
			const idString = Object.keys(contents)[0].split("_")[0];
			const mfield = Object.keys(contents)[0].split("_")[1];
			const value = Object.values(contents)[0];
		}catch(e){
			throw new InsightError("MComparator or its contents are null");
		}
		return true;
	}

	private logicFilter(courseOrRoom: Course | Room, filter: Filter): boolean {
		// TODO: need to change course parameter so it is course | room and treated as respective type in methods
		let ret = false;
		if ("AND" in filter && Array.isArray(filter["AND"]) && filter["AND"].length > 0) {
			let list = filter as LogicComparison;
			return list.AND.every((sub) => this.logicFilter(courseOrRoom, sub));
		} else if ("OR" in filter && Array.isArray(filter["OR"]) && filter["OR"].length > 0) {
			let list = filter as LogicComparison;
			return list.OR.some((sub) => this.logicFilter(courseOrRoom, sub));
		} else if("NOT" in filter){
			let negation = filter as LogicComparison;
			return !this.logicFilter(courseOrRoom, negation.NOT);
		} else {
			ret = this.filterQuery(filter, courseOrRoom);
			return ret;
		}
	}

	public setDatasetName(newName: string): void {
		if (newName === "") { // reset name
			this.datasetName = "";
		} else if (this.datasetName === "") {
			this.datasetName = newName;
		} else if (this.datasetName !== newName) {
			throw new InsightError("Dataset name is already set");
		}
	}

	public getDatasetName() {
		return this.datasetName;
	}

	public parseOptions(options: QueryOptions): QueryOptions { // sets the dataset to be queried on and returns the options object
		try{
			if (!Object.prototype.hasOwnProperty.call(options, "COLUMNS")) { // Is only here to ensure that we can do this
			}
		}catch(e){
			throw new InsightError("OPTIONS is missing");
		}
		if (Object.keys(options).length > 2 ) {
			throw new InsightError("invalid options format");
		}
		try{ // To ensure that columns isn't empty.
			let datasetName = Object.values(options)[0][0].split("_")[0];
			this.setDatasetName(datasetName);
		}catch (e) {
			throw new InsightError("Columns is empty");
		}
		if(this.datasetName === ""){
			this.setDatasetName(Object.values(options)[0][0].split("_")[0]);
		}
		let newOptions: QueryOptions;
		newOptions = {
			COLUMNS: Object.values(options)[0],
			ORDER: "no order",
		};
		if(options.ORDER !== undefined){
			if(typeof options.ORDER === "string"){
				(newOptions.ORDER as SortOptions) = options.ORDER as string;
			}else{
				(newOptions.ORDER as SortOptions) = options.ORDER as Direction;
				this.checkValidDirection(newOptions);
			}
		}
		newOptions.COLUMNS = Object.values(options)[0];
		// if (Object.keys(options).length === 2) { // Order is present
		// 	const orderField =  options.ORDER as string;
		// 	const columns = newOptions.COLUMNS as string[];
		// 	// if(!columns.includes(orderField)) {
		// 	// 	throw new InsightError("Order by field not found in columns");
		// 	// }
		// 	newOptions.ORDER = options.ORDER as string | Direction;
		// }

		return newOptions;
	}

	public checkValidDirection(options: QueryOptions): void{
		if((options.ORDER as Direction).dir !== "DOWN" && (options.ORDER as Direction).dir !== "UP"){
			throw new InsightError("Direction needs to be UP or DOWN");
		}
	}


	public parseTransformations(transformations: QueryTransformations): QueryTransformations{
		if(!Object.prototype.hasOwnProperty.call(transformations, "GROUP") ||
			!Object.prototype.hasOwnProperty.call(transformations, "APPLY") || Object.keys(transformations).length > 2){
			throw new InsightError("Transformations does not have either GROUP/APPLY or has a length greater than 2");
		}
		this.setDatasetName(Object.values(transformations)[0][0].split("_")[0]); // Attempt to set new dataset name
		let newTransformations = { // Redundant??
			GROUP: Object.values(transformations)[0],
			APPLY: Object.values(transformations)[1],
		};
		// this.groupBy = newTransformations.GROUP; // May not be necessary
		return newTransformations;
	}

	public getCourses(fileContents: {kind: "rooms", contents: Room[]} | {kind: "sections", contents: Course[]}) {
		this.courses = fileContents["contents"];
	}
}
