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

function parseData(sheet, row, data) {
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
            returnObj.push({ prop_value: targetSheet[row][obj.col].toFixed(obj.roundTo), prop_name: obj.prop_name });
        }
        return returnObj;
    } else {
        console.log(`Sheet ${sheet} not found!`);
        return returnObj;
    }
}

async function sendData(payload) {
    const logPath = './payloads.log';
    if (process.env.SEND_PAYLOADS === 'false') {
        const dateTime = new Date().toISOString().split('T')[0];
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
        }
    } catch (error) {
        console.error("Error sending payload!", error);
    }
}

function parseAndSend(obj) {
    let prop_values = parseData(obj.sheet, obj.row, obj.data);
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
}

export default function scheduleTasks() {
    for (const obj of dataToParse) {
        const job = new cron.CronJob(obj.cronExpr, () => {
            parseAndSend(obj);
        }, null, true);
        console.log("New task set!\nCronexpr: " + obj.cronExpr);
        console.log(`Payload:\nSheet:${obj.sheet}\nRow:${obj.row}\nMat_id:${obj.mat_id}`);
        job.start();
    }
}



