import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError
} from "./IInsightFacade";
import JSZip from "jszip";
import fs from "fs-extra";
import {
	ApplyRule, Course, Direction, Query, QueryOptions,
	QueryTransformations, Room, SortOptions
} from "./QueryInterfaces";
import {Document} from "parse5/dist/tree-adapters/default";

import {RoomHelperMethods} from "./RoomHelperMethods";
import {QueryHelperMethods} from "./QueryHelperMethods";
import {Building, RoomHelper} from "./RoomHelper";


const parse5 = require("parse5");

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private readonly datasetPath = "data/";
	private queryHelper = new QueryHelperMethods();
	// private roomHelper = new RoomHelperMethods();

	constructor() {
		console.log("InsightFacadeImpl::init()");
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError("invalid id");
		}
		const datasets = await this.getDatasetsFromDisk();
		if (datasets.indexOf(id + ".json") > -1) { // in the array
			throw new InsightError("duplicate id");
		}
		try {
			const fileContentsPromises: Array<Promise<string>> = [];
			if (kind === InsightDatasetKind.Sections) {
				const zip = await JSZip.loadAsync(content, {base64: true});
				zip.folder("courses")!.forEach(function(relativePath, file) {
					fileContentsPromises.push(file.async("text"));
				});

				const fileContents = await Promise.all(fileContentsPromises);
				let courses: Course[] = this.getValidCourses(fileContents);

				if (courses.length === 0) {
					throw new InsightError("no valid sections found");
				}
				await this.writeDatasetsToDisk(id, courses, "sections");
			} else if (kind === InsightDatasetKind.Rooms) {
				let rooms: Room[] = await this.parseRooms(content);
				let filteredRooms: Set<string> = new Set(rooms.map((x) => JSON.stringify(x)));
				rooms = [];
				for (let room of filteredRooms) {
					rooms.push(JSON.parse(room) as Room);
				}
				await this.writeDatasetsToDisk(id, rooms, "rooms");
			}
		} catch {
			throw new InsightError("error while reading zip file");
		}

		const datasetNames = datasets.map(getName);
		datasetNames.push(id); // current dataset has been written but is not included in datasets, so to avoid another read id is just pushed

		function getName(name: string) { // remove ".json" from file name
			return name.substring(0, name.length - 5);
		}

		return datasetNames;
	}

	private async parseRooms(content: string) {
		let roomhelper: RoomHelper = new RoomHelper();
		const zip = await JSZip.loadAsync(content, {base64: true});
		const index = zip.file("index.htm");
		if (index === null) {
			throw new InsightError("could not find index.htm");
		}
		const document: Document = parse5.parse(await index.async("text"));
		let buildings: Building[] = roomhelper.getBuildingLinks(document);
		let rooms: Room[] = [];
		const buildingPromises: Array<Promise<string>> = [];
		for (let building of buildings) {
			roomhelper.getGeolocation(building);
			const buildingFile = zip.file(building.filepath as string);
			if (buildingFile == null) {
				throw new InsightError("error reading building file");
			}
			buildingPromises.push(buildingFile.async("text"));
		}
		const buildingDocs = await Promise.all(buildingPromises);
		for (let i = 0; i < buildingDocs.length; i++) {
			rooms = rooms.concat(roomhelper.getRoomsInfo(parse5.parse(buildingDocs[i]), buildings[i]));
		}
		if (rooms.length === 0) {
			throw new InsightError("no valid rooms");
		}
		return rooms;
	}

	public async removeDataset(id: string): Promise<string> {
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError("invalid id");
		}
		const datasets = await this.getDatasetsFromDisk();
		if (datasets.indexOf(id + ".json") > -1) { // in the array
			await fs.unlink(this.datasetPath + id + ".json");
		} else {
			throw new NotFoundError("id not found");
		}
		return id;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// comment
		this.queryHelper.roomHelper = new RoomHelperMethods();
		let transformation: any = null;
		if (typeof query !== "object" || query === null) { // Can immediately reject a query if it is empty
			throw new InsightError("Query is not an object or is null");
		} else { // Check the validity of the query
			this.reset();
			let {WHERE, OPTIONS, TRANSFORMATIONS} = query as Query;
			this.queryHelper.roomHelper.isRoomsQuery = this.queryHelper.roomHelper.isRoomQuery(query as Query); // Determine if this is a rooms query and set global variable
			if(TRANSFORMATIONS){
				transformation = this.queryHelper.parseTransformations(TRANSFORMATIONS as QueryTransformations);
			}
			let returnedOptions = this.queryHelper.parseOptions(OPTIONS) ; // perform options parsing and find out what the dataset is first before filtering
			this.queryHelper.getCourses(await fs.readJSON(this.datasetPath + this.queryHelper.datasetName +
					".json"));
			let validCourses: Course[] = [];
			if(Object.keys(WHERE).length !== 0) { // Only parsing WHERE if it actually has stuff in it
				this.queryHelper.filterCourses(WHERE);
				validCourses = this.queryHelper.validCoursesOrRooms;
			}else{
				validCourses = this.queryHelper.courses;
			}
			let results: InsightResult[] = [];
			if(TRANSFORMATIONS){ // Case 1: with groups (therefore transformations)
				let groups = this.queryHelper.roomHelper.groupBy(transformation, validCourses); // GROUPING
				// transformation = this.queryHelper.parseTransformations(TRANSFORMATIONS as QueryTransformations);
				this.queryHelper.roomHelper.isValidApplyKey(TRANSFORMATIONS.APPLY as ApplyRule[]);
				let apply = this.queryHelper.roomHelper.applyOnGroups(groups, TRANSFORMATIONS.APPLY as ApplyRule[],
					TRANSFORMATIONS);
				this.queryHelper.roomHelper.keyInColumnsValid(TRANSFORMATIONS, returnedOptions);
				let applyKeys = apply[apply.length - 1];
				this.queryHelper.roomHelper.formatGroups(apply, results, applyKeys, TRANSFORMATIONS, returnedOptions);
				this.checkIfTooLarge(results);
			}else{ // Case 2: without groups
				// for (let course of validCourses) {
				// 	let result: InsightResult = {};
				// 	for (let column of returnedOptions.COLUMNS) {
				// 		if (column.split("_")[0] !== this.queryHelper.getDatasetName()) {
				// 			throw new InsightError("dataset name already set");
				// 		}
				// 	}
				// }
				// 	for (let column of returnedOptions.COLUMNS) {
				// 		let propertyName = column.split("_")[0] + "_" + column.split("_")[1];
				// 		result[propertyName] = course[column.split("_")[1]];
				// 	}
				// 	results.push(result);
				// 	this.checkIfTooLarge(results);
				// }
				// for(let course of validCourses){
				// 	let ret: InsightResult = {};
				// 	for(let column of returnedOptions.COLUMNS){
				// 		let name = column.split("_")[0] + "_" + column.split("_")[1];
				// 		ret[name] = course[column.split("_")[1]];
				// 	}
				// 	results.push(ret);
				// }
				results = this.resultsForNoTransformations(validCourses, returnedOptions);
				this.checkIfTooLarge(results);
			}
			if (returnedOptions.ORDER !== "no order") { // TODO make sure to check for SORT instead of order if it is a ROOM query
				this.orderColumns(results, returnedOptions);
			}
			return results;
		}
	}

	public resultsForNoTransformations(validCourses: Course[], returnedOptions: QueryOptions): InsightResult[] {
		for (let course of validCourses) {
			let result: InsightResult = {};
			for (let column of returnedOptions.COLUMNS) {
				if (column.split("_")[0] !== this.queryHelper.getDatasetName()) {
					throw new InsightError("dataset name already set");
				}
			}
		}
		let results: InsightResult[] = [];
		for(let course of validCourses){
			let ret: InsightResult = {};
			for(let column of returnedOptions.COLUMNS){
				let name = column.split("_")[0] + "_" + column.split("_")[1];
				ret[name] = course[column.split("_")[1]];
			}
			results.push(ret);
		}
		return results;
	}

	public checkIfTooLarge(array: any[]): void{
		if(array.length > 5000){
			throw new ResultTooLargeError("Results exceeded 5,000");
		}
	}

	public orderColumns(results: InsightResult[], options: QueryOptions): InsightResult[]{
		if(typeof (options.ORDER) === "string"){
			let stringOptions = options.ORDER;
			results.sort((a, b) => {
				const aValue = a[stringOptions].toString();
				const bValue = b[stringOptions].toString();
				return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
			});
		}else{
			// We know it is a direction
			let directionOptions = options.ORDER as Direction;
			return results.sort((a, b): number => {
				let comparisonResult = 0;
				for(const k of directionOptions.keys){
					let key = k;
					const aValue = a[key].toString();
					const bValue = b[key].toString();
					if(aValue !== bValue){
						if(directionOptions.dir === "UP"){
							comparisonResult = aValue < bValue ? -1 : 1;
						}else{ // For "DOWN"
							comparisonResult = aValue < bValue ? 1 : -1;
						}
						break; // Exit the loop once we've found a difference
					}
				}
				return comparisonResult;
			});
		}
		return results;
	}

	private reset(){
		this.queryHelper.setDatasetName("");
		this.queryHelper.roomHelper.isRoomsQuery = false;
		this.queryHelper.roomHelper.datasetName = "";
		this.queryHelper.roomHelper.applyKeys = [];
	}


	public async listDatasets(): Promise<InsightDataset[]> {
		let fileNames: string[] = await this.getDatasetsFromDisk();
		let fileContentsPromises: Array<Promise<string[]>> = [];
		let datasetNames: string[] = [];
		let datasets: InsightDataset[] = [];

		for (let fileName of fileNames) {
			fileContentsPromises.push(fs.readJSON(this.datasetPath + fileName));
			datasetNames.push(fileName.substring(0, fileName.length - 5));
		}
		const fileContents = await Promise.all(fileContentsPromises);
		for (let i = 0; i < fileContents.length; i++) {
			let kind = Object.values(fileContents[i])[0];
			let contents = Object.values(fileContents[i])[1];
			let numValidSections = contents.length;
			if (kind === "rooms") {
				datasets.push({id: datasetNames[i], kind: InsightDatasetKind.Rooms, numRows: numValidSections});
			} else {
				datasets.push({id: datasetNames[i], kind: InsightDatasetKind.Sections, numRows: numValidSections});
			}
		}

		return datasets;
	}

	private async getDatasetsFromDisk(): Promise<string[]> {
		const filesExist = await fs.pathExists(this.datasetPath);
		if (!filesExist) {
			await fs.mkdir(this.datasetPath);
		}
		return fs.readdir(this.datasetPath);
	}

	private async writeDatasetsToDisk(name: string, fileContents: Course[] | Room[], kind: string): Promise<void> {
		let contents = {kind: kind, contents: fileContents};
		await fs.outputJson(this.datasetPath + name + ".json", contents);
	}

	private getValidCourses(fileContents: string[]) {
		let courses: Course[] = [];
		for (let fileContent of fileContents) {
			const json = JSON.parse(fileContent);
			for (let section of json["result"]) {
				if (Object.prototype.hasOwnProperty.call(section, "id") &&
					Object.prototype.hasOwnProperty.call(section, "Course") &&
					Object.prototype.hasOwnProperty.call(section, "Title") &&
					Object.prototype.hasOwnProperty.call(section, "Professor") &&
					Object.prototype.hasOwnProperty.call(section, "Subject") &&
					Object.prototype.hasOwnProperty.call(section, "Year") &&
					Object.prototype.hasOwnProperty.call(section, "Avg") &&
					Object.prototype.hasOwnProperty.call(section, "Pass") &&
					Object.prototype.hasOwnProperty.call(section, "Fail") &&
					Object.prototype.hasOwnProperty.call(section, "Audit")) {
					courses.push ({
						uuid: String(section["id"]),
						id: section["Course"],
						title: section["Title"],
						instructor: section["Professor"],
						dept: section["Subject"],
						year: section["Year"],
						avg: section["Avg"],
						pass: section["Pass"],
						fail: section["Fail"],
						audit: section["Audit"]
					} as Course);
				}
			}
		}
		return courses;
	}
}
