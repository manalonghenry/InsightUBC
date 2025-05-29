import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	ResultTooLargeError
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";
import {clearDisk, getContentFromArchives, readFileQueries} from "../TestUtil";

use(chaiAsPromised);

export interface ITestQuery {
	title: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let rooms: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		rooms = await getContentFromArchives("campus.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {

		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			facade = new InsightFacade();
		});

		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});

		it("should add rooms", async function () {
			const result = facade.addDataset("ubc", rooms, InsightDatasetKind.Rooms);

			return expect(result).to.eventually.have.ordered.members(["ubc"]);
		});

		it("should reject with  an empty dataset id", async function () {
			const result = facade.addDataset("", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should add a valid dataset", function () {
			const result = facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.ordered.members(["ubc"]);
		});

		it("should add valid datasets", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			await facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
			const result = facade.addDataset("ubc3", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.ordered.members(["ubc", "ubc2", "ubc3"]);
		});

		it("should reject ids with underscores in them", function () {
			const result = facade.addDataset("hee_hee", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject ids that are an empty string", function () {
			const result = facade.addDataset("", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject ids that are only whitespace characters", function () {
			const result = facade.addDataset("  \t  \n   ", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject duplicate ids", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			const result = facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject duplicate ids even if different sections", async function () {
			const otherSection = await getContentFromArchives("one-invalid-one-valid-section.zip");

			await facade.addDataset("ubc", otherSection, InsightDatasetKind.Sections);
			const result = facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject duplicate ids across different instances", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			let newFacade = new InsightFacade();

			const result = newFacade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset without courses folder", async function () {
			let noCoursesZip = await getContentFromArchives("no-courses.zip");

			const result = facade.addDataset("ubc", noCoursesZip, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset where sections are top level", async function () {
			let zip = await getContentFromArchives("top-level-section.zip");

			const result = facade.addDataset("ubc", zip, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset where list of sections are top level", async function () {
			let zip = await getContentFromArchives("top-level-section-list.zip");

			const result = facade.addDataset("ubc", zip, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset without anything in results section", async function () {
			let zip = await getContentFromArchives("no-sections.zip");

			const result = facade.addDataset("ubc", zip, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset where courses folder is named poorly", async function () {
			let zip = await getContentFromArchives("wrong-subfolder-name.zip");

			const result = facade.addDataset("ubc", zip, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset that isn't base64", function () {
			const result = facade.addDataset("ubc", "%", InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a zip file with file types that are not json", async function () {
			const notJson = await getContentFromArchives("courses-not-json.zip");

			const result = facade.addDataset("ubc", notJson, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset that isn't a valid zip file", function () {
			const result = facade.addDataset("ubc", "aGVsbG8gd29ybGQ=", InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset that does not have sections", async function () {
			const emptyZipFile = await getContentFromArchives("empty.zip");

			const result = facade.addDataset("ubc", emptyZipFile, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a dataset with only invalid sections", async function () {
			const invalidSectionZip = await getContentFromArchives("invalid-section-only.zip");

			const result = facade.addDataset("ubc", invalidSectionZip, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject any kind that is not a section", function () {
			const result = facade.addDataset("ubc", sections, InsightDatasetKind.Rooms);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
	});

	describe("removeDataset", function () {

		before(async function () {
			sections = await getContentFromArchives("small.zip");
		});

		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
		});

		it("should reject remove with an empty dataset id", function () {
			const result = facade.removeDataset("");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should remove a valid dataset", function () {
			const result = facade.removeDataset("ubc");

			return expect(result).to.eventually.equal("ubc");
		});

		it("should remove multiple datasets", async function () {
			await facade.addDataset("bbbbb", sections, InsightDatasetKind.Sections);

			await facade.removeDataset("ubc");
			const result = facade.removeDataset("bbbbb");

			return expect(result).to.eventually.equal("bbbbb");
		});

		it("should remove dataset with a whitespace in it", async function () {
			await facade.addDataset("bbb bb", sections, InsightDatasetKind.Sections);

			await facade.removeDataset("ubc");
			const result = facade.removeDataset("bbb bb");

			return expect(result).to.eventually.equal("bbb bb");
		});

		it("should reject to remove ids with underscores in them", function () {
			const result = facade.removeDataset("hee_hee");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject to remove ids that are an empty string", function () {
			const result = facade.removeDataset("");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject to remove ids that are only whitespace characters", function () {
			const result = facade.removeDataset("  \t  \n   ");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject to remove non existing ids", function () {
			const result = facade.removeDataset("ucb");

			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should reject to remove the same id twice in a row", async function () {
			await facade.removeDataset("ubc");
			const result = facade.removeDataset("ubc");

			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should act as if nothing was added after a remove", async function () {
			await facade.addDataset("abc", sections, InsightDatasetKind.Sections);
			await facade.removeDataset("abc");
			const result = facade.addDataset("geob", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.ordered.members(["ubc", "geob"]);
		});

		it("should be able to re-add after removing", async function () {
			await facade.removeDataset("ubc");
			const result = facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.ordered.members(["ubc"]);
		});
	});

	describe("listDataset", function () {

		before(async function () {
			sections = await getContentFromArchives("small.zip");
		});

		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should list empty set if nothing in datasets", function () {
			facade = new InsightFacade();

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.ordered.members([]);
		});

		it ("should list rooms correctly", async function () {
			const allrooms = await getContentFromArchives("campus.zip");
			const dataset: InsightDataset = {
				id: "ubc",
				kind: InsightDatasetKind.Rooms,
				numRows: 364
			};
			await facade.addDataset("ubc", allrooms, InsightDatasetKind.Rooms);

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.deep.members([dataset]);
		});

		it("should list one dataset correctly", async function () {
			const bigSections = await getContentFromArchives("pair.zip");
			const dataset: InsightDataset = {
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 64612
			};
			await facade.addDataset("ubc", bigSections, InsightDatasetKind.Sections);

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.deep.members([dataset]);

		});

		it("should list sections correctly even if unintuitive", async function () {
			const unintuitive = await getContentFromArchives("section-unintuitive.zip");
			await facade.addDataset("wawa", unintuitive, InsightDatasetKind.Sections);
			const dataset: InsightDataset = {
				id: "wawa",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			};

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.deep.members([dataset]);
		});

		it("should list datasets correctly", async function () {
			facade = new InsightFacade();
			const dataset1: InsightDataset = {
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			};
			const dataset2: InsightDataset = {
				id: "hehe",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			};
			await facade.addDataset(dataset1.id, sections, InsightDatasetKind.Sections);
			await facade.addDataset(dataset2.id, sections, InsightDatasetKind.Sections);

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.deep.members([dataset1, dataset2]);
		});

		it("should list datasets across instances", async function () {
			facade = new InsightFacade();
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const otherFacade = new InsightFacade();
			await otherFacade.addDataset("hehe", sections, InsightDatasetKind.Sections);

			const result = otherFacade.listDatasets();

			return expect(result).to.eventually.have.deep.members([{
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			}, {
				id: "hehe",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			}]);
		});

		it("should list only the sections in the correct folder", async function () {
			let zip = await getContentFromArchives("multiple-courses-subfolder.zip");
			await facade.addDataset("ubc", zip, InsightDatasetKind.Sections);

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.deep.members([{
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			}]);
		});

		it("should list correct number of valid sections for each dataset", async function () {
			facade = new InsightFacade();
			const oneSectionZip = await getContentFromArchives("one-invalid-one-valid-section.zip");
			await facade.addDataset("ubc", oneSectionZip, InsightDatasetKind.Sections);
			await facade.addDataset("hehe", sections, InsightDatasetKind.Sections);
			const dataset1: InsightDataset = {
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 1
			};
			const dataset2: InsightDataset = {
				id: "hehe",
				kind: InsightDatasetKind.Sections,
				numRows: 2
			};

			const result = facade.listDatasets();

			return expect(result).to.eventually.have.deep.members([dataset1, dataset2]);
		});
	});

	/*
	 * This test suite dynamically generates tests from the JSON files in test/resources/queries.
	 * You can and should still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("PerformQuery", function () {
		before(async function () {
			await clearDisk();
			facade = new InsightFacade();
			rooms = await getContentFromArchives("campus.zip");

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			// const loadDatasetPromises = [
			await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
			await facade.addDataset("rooms", rooms, InsightDatasetKind.Rooms);
			// ];

			// try {
			// await Promise.all(loadDatasetPromises);
			// } catch(err) {
			// 	throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			// }
		});

		after(async function () {
			await clearDisk();
		});

		describe("valid queries", function() {
			let validQueries: ITestQuery[];
			try {
				validQueries = readFileQueries("valid");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			validQueries.forEach(function (test: any) {
				it(`${test.title}`, async function () {
					try {
						const insightResults = await facade.performQuery(test.input);
						// console.log(insightResults);
						// console.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -");
						// console.log(test.expected);
						expect(insightResults).to.deep.equal(test.expected);
					} catch (err) {
						assert.fail(`performQuery threw unexpected error: ${err}`);
					}
				});
			});
		});

		describe("invalid queries", function() {
			let invalidQueries: ITestQuery[];

			try {
				invalidQueries = readFileQueries("invalid");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			invalidQueries.forEach(function (test: any) {
				it(`${test.title}`, async function () {
					const result = facade.performQuery(test.input);
					if (test.expected === "InsightError") {
						return expect(result).to.eventually.be.rejectedWith(InsightError);
					} else if (test.expected === "ResultTooLargeError") {
						return expect(result).to.eventually.be.rejectedWith(ResultTooLargeError);
					} else {
						expect.fail(`invalid value for test.expected: ${test.expected}`);
					}
				});
			});
		});
	});
});
