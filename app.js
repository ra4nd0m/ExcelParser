import xlsx from "node-xlsx";
import fs from 'fs';
import cron from "cron";
import dotenv from "dotenv";

dotenv.config();
const configPath = 'dataset.json';
const dataToParse = JSON.parse(fs.readFileSync('dataset.json', 'utf-8'));
const spreadsheetPath = process.env.SHEET_PATH;
const apiKey = process.env.API_KEY;

function updateConfig(configPath, updatedConfig) {
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
}

function parseData(sheet, row, data, mat_id) {
    console.log(`Parsing data for sheet: ${sheet} Row:${row}`);
    const workbook = xlsx.parse(spreadsheetPath);
    let targetSheet;
    let returnObj = [];
    for (let i = 0; i < workbook.length; i++) {
        if (workbook[i].name === sheet) {
            targetSheet = workbook[i].data;
            break;
        }
    }
    if (targetSheet) {
        console.log(`Sheet found!`);
        for (let obj of data) {
            console.log(targetSheet[row]);
            if (targetSheet[row][obj.col].length === 0) {
                const errMsg = `Error: ${new Date().toISOString().split('T')[0]}\nRow for mat_id${mat_id} is empty!`;
                fs.appendFileSync("error.log", errMsg, 'utf-8');
                fs.appendFileSync("importer.log", errMsg, 'utf-8');
            } else {
                const pushMsg = `Pushing data for mat_id: ${mat_id} into payload...`;
                fs.appendFileSync("importer.log", pushMsg, 'utf-8');
                returnObj.push({ prop_value: targetSheet[row][obj.col], prop_name: obj.prop_name });
            }
        }
        return returnObj;
    } else {
        fs.appendFileSync("importer.log", `Sheet ${sheet} not found!`, 'utf-8');
        return returnObj;
    }
}

async function sendData(payload) {
    const logPath = './payloads.log';
    const dateTime = new Date().toISOString().split('T')[0];
    if (process.env.SEND_PAYLOADS === 'false') {
        const logEntry = `${dateTime} - Payload:\n${JSON.stringify(payload, null, 2)}\n\n`;
        fs.appendFileSync(logPath, logEntry, 'utf8');
        return;
    }
    try {
        const resp = await fetch('http://localhost:8080/addValue', {
            method: 'POST',
            headers: { Authorization: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
        } else {
            console.log("Payload sent!");
            fs.appendFileSync("importer.log", `${dateTime}:   Data sent!`, 'utf-8');
        }
    } catch (error) {
        console.error("Error sending payload!", error);
        fs.appendFileSync("error.log", `${dateTime}:  Error sending payload! Error:\n${error}`, 'utf-8');
    }
}

function parseAndSend(obj) {
    let prop_values = parseData(obj.sheet, obj.row, obj.data, obj.mat_id);
    if (prop_values && prop_values.length > 0) {
        for (const value of prop_values) {
            const date = new Date().toISOString().split('T')[0];
            let payload = {
                material_source_id: obj.mat_id,
                property_name: value.prop_name,
                value_float: `${value.prop_value}`,
                value_str: `${value.prop_value}`,
                created_on: date
            }
            sendData(payload);
        }
        obj.row += 1;
        updateConfig(configPath, dataToParse);
    } else {
        const errMsg = `Error! ${new Date().toISOString().split('T')[0]}\nNo data found in file!\nmat_id: ${obj.mat_id}\nrow: ${obj.row}\nsheet: ${obj.sheet}`;
        fs.appendFileSync("importer.log", errMsg, 'utf-8');
        fs.appendFileSync('error.log', errMsg, 'utf-8');
    }
}



export default function scheduleTasks() {
    for (const obj of dataToParse) {
        const job = new cron.CronJob(obj.cronExpr, () => {
            parseAndSend(obj);
        }, null, true);
        console.log("New task set!\nCronexpr: " + obj.cronExpr);
        console.log(`Task:\nSheet:${obj.sheet}\nRow:${obj.row}\nMat_id:${obj.mat_id}`);
        job.start();
        if (process.env.DEBUG_SEND === 'true') {
            console.log("WARNING! Operations are set to instant execute!");
            debugNoSchedulingOperation(obj);
        };
    };
}


function debugNoSchedulingOperation(obj) {
    if (process.env.THURSD_NOW === 'true' && obj.cronExpr === "0 22 * * 4") {
        parseAndSend(obj);
    };
    if (process.env.FRI_NOW === 'true' && obj.cronExpr === "0 22 ** 5") {
        parseAndSend(obj);
    };
    if (process.env.INSTANT_SEND === 'true') {
        parseAndSend(obj);
    };
}

