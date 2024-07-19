import scheduleTasks from "./app.js";
import fs from "fs";

const spreadsheetPath = process.env.SHEET_PATH;
if (fs.existsSync(spreadsheetPath)) {
    console.log("Spreadsheet found at " + spreadsheetPath + " Starting up...");
    console.log("Send payloads is set to: " + process.env.SEND_PAYLOADS);
    scheduleTasks();
} else {
    console.error("Spreadsheet is NOT found at " + spreadsheetPath + "! Shutting down...");
}