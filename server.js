// Generic server cli startup script v0.0.1
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import fetch from "node-fetch";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import startServer from "./src/startServer";

const commandOptions = [
	{ name: 'config', alias: 'c', description: 'Configuration file or URL', type: String, defaultOption: true},
	{ name: 'debug', alias: 'd', description: 'Debug', type: Boolean, defaultOption: false},
	{ name: 'help', alias: 'h', description: 'Display this help', type: Boolean}
];

const configDefaultFile = path.join(__dirname, 'config.json');

const configDefaults = {
	debug: true
};

let config = configDefaults;

const commandLineOptions = commandLineArgs(commandOptions);

if(commandLineOptions.help)
	displayHelp();
else {
	(async () => {
		try {
			config = await fetchConfig(commandLineOptions.config, configDefaultFile, configDefaults);
			startServer(Object.assign({}, config, {
				debug: (config.debug) ? debug : config.debug
			}));
		}
		catch(error) {
			console.error(error);
			process.exit(1);
		}
	})();
}

function debug() {
	if(config.debug)
		console.log.apply(console, Array.prototype.slice.call(arguments));
}

async function fetchConfig(commandLineConfigFile, configDefaultFile, configDefaults) {
	let configOverridesFile = null;

	if(commandLineConfigFile !== undefined)
		configOverridesFile = commandLineConfigFile;
	else if(process.env.hasOwnProperty('CONFIG_FILE'))
		configOverridesFile = process.env.CONFIG_FILE;
	else
		configOverridesFile = configDefaultFile;

	const configOverrides = await readFileOrUrl(configOverridesFile, true);

	return Object.assign(configDefaults, configOverrides);
}

async function readFileOrUrl(fileOrUrl, parseAsJson = false) {
	if(validURL(fileOrUrl)) { // URL
		const url = new URL(fileOrUrl);
		const fetchAgent = (url.protocol === 'https:')
			? new https.Agent({
				rejectUnauthorized: false
			})
			: new http.Agent();

		let response = await fetch(fileOrUrl, {
			agent: fetchAgent
		});

		if(parseAsJson)
			return await response.json();
		else
			return await response.text();
	}
	else { // File
		let fileContents = fs.readFileSync(fileOrUrl, 'utf8');
		if(parseAsJson)
			return JSON.parse(fileContents);
		else
			return fileContents;
	}

	function validURL(str) {
		try {
			new URL(str);
			return true;
		}
		catch(error) {
			return false;
		}
	}
}

function displayHelp() {
	const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

	const commandSections = [
		{
			header: packageInfo.name,
			content: [
				'Version: ' + packageInfo.version,
				'Description: ' + packageInfo.description
			]
		},
		{
			header: 'Command Line Options',
			optionList: commandOptions
		}
	];

	console.log(commandLineUsage(commandSections));
}
