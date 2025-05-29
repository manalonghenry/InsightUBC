import Server from "../../src/rest/Server";
import InsightFacade from "../../src/controller/InsightFacade";

import {expect} from "chai";
import request, {Response} from "supertest";
import * as fs from "fs-extra";
import assert from "node:assert";
import {clearDisk, getContentFromArchives} from "../TestUtil";
import {InsightDatasetKind} from "../../src/controller/IInsightFacade";
import {Request} from "express";
import exp from "node:constants";


describe("Facade D3", function () {

	let facade: InsightFacade;
	let server: Server;
	let url: string;
	let roomFile: any;
	let sectionFile: any;
	let enpointURL: string;

	before(async function () {
		await clearDisk();
		facade = new InsightFacade();
		server = new Server(4321);
		// TODO: start server here once and handle errors properly
		url = "http://localhost:4321";
		try{
			let pathRoom = "test/resources/archives/campus.zip";
			let pathSection = "test/resources/archives/pair.zip";
			roomFile = await fs.readFile(pathRoom);
			sectionFile = await fs.readFile(pathSection);
			await server.start();
		}catch (e){
			throw new Error(`Error in before spec.ts: ${e}`);
		}
	});

	after(async function () {
		// TODO: stop server here once!
		await server.stop();
	});

	beforeEach(function () {
		// might want to add some process logging here to keep track of what is going on
	});

	afterEach(function () {
		// might want to add some process logging here to keep track of what is going on
	});

	// Sample on how to format PUT requests
	/*
	it("PUT test for courses dataset", function () {
		try {
			return request(url)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(200);
				})
				.catch(function (err) {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			// and some more logging here!
		}
	});
	*/

	// The other endpoints work similarly. You should be able to find all instructions at the supertest documentation
	it("Empty Get Test", function(){
		try{
			return (request(url).get("/datasets").then(function(response: Response){
				expect(response.status).to.be.equal(200);
				expect(response.body.result).to.deep.equal([]);
			})).catch(function(error){
				assert.fail(`Error in Empty Get Test: ${error}`);
			});
		}catch (error){
			assert.fail(`Try-catch Error in Empty Get Test: ${error}`);
		}
	});

	it("Courses Put Test", function(){
		try{
			return request(url).put("/dataset/ubc/sections").send(sectionFile)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function(response: Response){
					expect(response.status).to.be.equal(200);
					expect(response.body.result).to.be.have.members(["ubc"]);
				})
				.catch(function(error){
					assert.fail(`Error in Courses Put Test: ${error}`);
				});
		}catch (error){
			assert.fail(`Error in Courses Put Test: ${error}`);
		}
	});

	it("should fail Put because of a duplicate id", function(){
		try{
			return request(url).put("/dataset/ubc/").set(sectionFile)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function(response: Response){
					expect(response.status).to.be.equal(400);
				})
				.catch(function(error){
					assert.fail(`Error in Put Duplicate Test: ${error}`);
				});
		}catch (error){
			assert.fail(`Error in Put Duplicate Test: ${error}`);
		}
	});

	it("should fail Put because of underscore in id", function(){
		try{
			return request(url).put("/dataset/ubc/_").send(sectionFile)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function(response: Response){
					expect(response.status).to.be.equal(400);
				})
				.catch(function(error){
					assert.fail(`Error in Underscore Put Test: ${error}`);
				});
		}catch(error){
			assert.fail(`Error in Underscore Put Test: ${error}`);
		}
	});

	it("Should Post Courses successfully", function(){
		try{
			return request(url).post("/query")
				.send({
					WHERE: {
						LT: {
							ubc_avg: 54
						}
					},
					OPTIONS: {
						COLUMNS: [
							"ubc_dept",
							"ubc_title",
							"ubc_avg"
						],
						ORDER: "ubc_avg"
					}
				})
				.then(function(response: Response){
					expect(response.status).to.be.equal(200);
				}).catch(function(error){
					assert.fail(`Error in Post Courses Test: ${error}`);
				});
		}catch (error){
			assert.fail(`Error in Post Courses Test: ${error}`);
		}
	});

	it("Should fail Post because of invalid query", function(){
		try{
			return request(url).post("/query").send({
				WHERE: {
					LT: {
						ubc_avg: 54
					}
				},
				OPTIONS: {
					COLUMNS: [
						"ubc_dept",
						"ubc_title",
						"ubc_avg"
					],
					ORDER: "sections_avg"
				}
			}).then(function(response: Response){
				expect(response.status).to.be.equal(400);
			}).catch(function(error){
				assert.fail(`Error in Post Invalid Query Test: ${error}`);
			});
		}catch (error){
			assert.fail(`Error in Post Invalid Query Test: ${error}`);
		}
	});


});
