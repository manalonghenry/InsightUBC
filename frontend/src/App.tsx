import React, {useState} from "react";
//import { useForm } from "react-hook-form";
import "./App.css";
import {InsightResult} from "../../src/controller/IInsightFacade";

function App() {
	const [datasets, setDatasets] = useState([] as InsightResult[]);
	const [newDataset, setNewDataset] = useState("");
	const [file, setFile] = useState();

	function handleInputChange(event: any) {
		setNewDataset(event.target.value);
	}

	function handleFile(event: any) {
		setFile(event.target.files[0]);
	}

	async function handleUpload() {
		if (file) {

			if (newDataset.trim() !== "" && !newDataset.includes("_")) {
				const response = await fetch("http://localhost:4321/dataset/" + newDataset + "/sections", {
					method: "PUT",
					body: file
				});

				const responseJson = await response.json();
				if ("error" in responseJson) {
					alert(responseJson["error"]);
				} else {
					alert("dataset added successfully")
				}
				return responseJson["result"];
			} else {
				alert("dataset ID may not be empty or contain underscores");
			}
		} else {
			alert("please upload a file");
		}
	}
	// setDatasets(await syncDatasets());
	return (
		<div>
			<h1>Section Insights</h1>

			<input
				type="text"
				placeholder="Enter dataset ID"
				value={newDataset}
				onChange={handleInputChange} />

			<input onChange={handleFile} type="file" name="file" />
			<br></br>
			<button onClick={async () => {
				await handleUpload();
				setDatasets(await syncDatasets());
			}}>Upload Dataset
			</button>


			{SyncDatasetsButton(setDatasets)}
			{DatasetListingTable(datasets, setDatasets)}
		</div>
	);
}

function SyncDatasetsButton(setDatasets: any) {
	return <button onClick={async () => {
		setDatasets(await syncDatasets());
	}}>
		Sync now!
	</button>;
}

async function syncDatasets(): Promise<InsightResult[]> {
	const response = await fetch("http://localhost:4321/datasets");
	const responseJson = await response.json();
	return responseJson["result"];
}

async function deleteDataset(id: string): Promise<string> {
	const response = await fetch("http://localhost:4321/dataset/" + id, {
		method: "DELETE"
	});
	const responseJson = await response.json();
	return responseJson["result"];
}

function DatasetListingTable(datasets: InsightResult[], setDatasets: any) {
	return <table>
		<tr>
			<th>ID</th>
			<th>num rows</th>
			<th></th>
		</tr>
		{datasets.map((dataset, id) => DatasetListingRow(dataset, setDatasets))}
	</table>;
}

function DatasetListingRow(dataset: InsightResult, setDatasets: any) {
	return <tr>
		<td>{dataset["id"]}</td>
		<td>{dataset["numRows"]}</td>
		<td>
			<button onClick={async () => { await deleteDataset(dataset["id"] as string); setDatasets(await syncDatasets());}}>Delete</button>
		</td>
	</tr>;
}

export default App;
