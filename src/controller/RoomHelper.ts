import {Document, Element} from "parse5/dist/tree-adapters/default";
import http from "http";
import {InsightError} from "./IInsightFacade";
import {Attribute} from "parse5/dist/common/token";
import {Room} from "./QueryInterfaces";

interface GeoResponse {
	lat?: number;
	lon?: number;
	error?: string;
}

export interface Building {
	[key: string]: string | number | null;
	filepath: string | null;
	fullname: string | null;
	shortname: string | null;
	address: string | null;
	lat: number | null;
	lon: number | null;
}

// export interface Room {
// 	[key: string]: string | number;
// 	fullname: string;
// 	shortname: string;
// 	number: string;
// 	name: string;
// 	address: string;
// 	type: string;
// 	furniture: string;
// 	href: string;
// 	lat: number;
// 	lon: number;
// 	seats: number;
// }

interface RoomInfo {
	[key: string]: string | number | null;
	seats: number | null;
	furniture: string | null;
	type: string | null;
	number: string | null;
	href: string | null;
}
export class RoomHelper {
	private teamNumber = "071";
	private url = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team";
	public getRoomsInfo(document: Document, building: Building) {
		let rooms: Room[] = [];
		for (let tr of this.getElementsByTag(document, "tr")) {
			let tempRoomInfo: RoomInfo;
			tempRoomInfo = {seats: null, furniture: null, type: null, number: null, href: null};
			for (let td of this.getElementsByTag(tr, "td")) {
				if (this.elementHasClass(td, "views-field-field-room-number")) {
					let aTag = this.getElementsByTag(td, "a");
					for (let attr of aTag[0].attrs) {
						if (attr.name === "href") {
							tempRoomInfo.href = (attr.value);
						}
					}
					if ("value" in aTag[0].childNodes[0]) {
						tempRoomInfo.number = aTag[0].childNodes[0].value;
					}
				}
				if (this.elementHasClass(td, "views-field-field-room-capacity")) {
					if ("value" in td.childNodes[0]) {
						tempRoomInfo.seats = parseInt(td.childNodes[0].value.trim(), 10);
					}
				}
				if (this.elementHasClass(td, "views-field-field-room-furniture")) {
					if ("value" in td.childNodes[0]) {
						tempRoomInfo.furniture = td.childNodes[0].value.trim();
					}
				}
				if (this.elementHasClass(td, "views-field-field-room-type")) {
					if ("value" in td.childNodes[0]) {
						tempRoomInfo.type = td.childNodes[0].value.trim();
					}
				}
				if (tempRoomInfo.furniture !== null && tempRoomInfo.seats !== null
					&& tempRoomInfo.number !== null && tempRoomInfo.href !== null
					&& tempRoomInfo.type !== null) {
					let newRoom: Room = {seats: tempRoomInfo.seats, furniture: tempRoomInfo.furniture,
						number: tempRoomInfo.number, href: tempRoomInfo.href,
						type: tempRoomInfo.type, address: building.address as string,
						fullname: building.fullname as string, shortname: building.shortname as string,
						lat: building.lat as number, lon: building.lon as number,
						name: building.shortname + "_" + tempRoomInfo.number};
					rooms.push(newRoom);
				}
			}
		}
		return rooms;
	}

	public getBuildingLinks(document: Document) {
		let buildings: Building[] = [];
		for (let tr of this.getElementsByTag(document, "tr")) {
			let tempBuilding: Building;
			tempBuilding = {filepath: null, shortname: null, address: null, fullname: null, lat: null, lon: null};
			for (let td of this.getElementsByTag(tr, "td")) {
				if (this.elementHasClass(td, "views-field-title")) {
					let aTag = this.getElementsByTag(td, "a");
					for (let attr of aTag[0].attrs) {
						if (attr.name === "href") {
							tempBuilding.filepath = (attr.value.substring(2));
						}
					}
					if ("value" in aTag[0].childNodes[0]) {
						tempBuilding.fullname = aTag[0].childNodes[0].value;
					}
				}
				if (this.elementHasClass(td, "views-field-field-building-code")) {
					if ("value" in td.childNodes[0]) {
						tempBuilding.shortname = td.childNodes[0].value.trim();
					}
				}
				if (this.elementHasClass(td, "views-field-field-building-address")) {
					if ("value" in td.childNodes[0]) {
						tempBuilding.address = td.childNodes[0].value.trim();
					}
				}
				if (tempBuilding.values !== null && tempBuilding.shortname !== null
					&& tempBuilding.filepath !== null && tempBuilding.fullname !== null) {
					buildings.push(tempBuilding);
				}
			}
		}
		if (buildings.length === 0) {
			throw new InsightError("no valid building files in table");
		}
		return buildings;
	}

	private elementHasClass(node: Element, className: string) {
		let predicate = function(attr: Attribute) {
			return attr.name === "class" && attr.value.includes(className);
		};
		return node.attrs.some(predicate);
	}

	private getElementsByTag(node: Element | Document, tagName: string) {
		let nodes: Element[] = [];


		if (node.nodeName === tagName && "attrs" in node) {
			nodes.push(node);
		}

		for (let child of node.childNodes) {
			if ("childNodes" in child) {
				nodes = nodes.concat(this.getElementsByTag(child, tagName));
			}
		}

		return nodes;
	}

	public getGeolocation(building: Building) {
		let address = encodeURIComponent(building.address as string);
		let geolocation: GeoResponse;
		http.get(this.url + this.teamNumber + "/" + address, (res) => {
			const {statusCode} = res;
			const contentType = res.headers["content-type"];

			let error;
			// Any 2xx status code signals a successful response but
			// here we're only checking for 200.
			if (statusCode !== 200) {
				error = new Error("Request Failed.\n" +
					`Status Code: ${statusCode}`);
			} else if (!/^application\/json/.test(contentType as string)) {
				error = new Error("Invalid content-type.\n" +
					`Expected application/json but received ${contentType}`);
			}
			if (error) {
				console.error(error.message);
				// Consume response data to free up memory
				res.resume();
				return;
			}

			res.setEncoding("utf8");
			let rawData = "";
			res.on("data", (chunk) => {
				rawData += chunk;
			});
			res.on("end", () => {
				try {
					geolocation = JSON.parse(rawData) as GeoResponse;
					building.lat = geolocation.lat as number;
					building.lon = geolocation.lon as number;
				} catch (e: any) {
					console.error(e.message);
				}
			});
		});
	}
}
