let AWS = require('aws-sdk');
let parser = require("mailparser").simpleParser;

//
//	Initialize S3.
//
let s3 = new AWS.S3({
	apiVersion: '2006-03-01'
});

//
//	This Lambda will filter all the incoming emails based on their From and To
//	field.
//
exports.handler = (event) => {

	//
	//	1.	We need to process the path received by S3 since AWS dose escape
	//		the string in a special way. They escape the string in a HTML style
	//		but for whatever reason they convert spaces in to +ses.
	//
	let s3_key = event.Records[0].s3.object.key;

	//
	//	2.	So first we convert the + in to spaces.
	//
	let plus_to_space = s3_key.replace(/\+/g, ' ');

	//
	//	3.	And then we unescape the string, other wise we lose
	//		real + characters.
	//
	let unescaped_key = decodeURIComponent(plus_to_space);

	//
	//	4.	This JS object will contain all the data within the chain.
	//
	let container = {
		bucket: event.Records[0].s3.bucket.name,
		key: unescaped_key
	};

	//
	//	->	Start the chain.
	//
	load_the_email(container)
		.then(function(container) {

			return parse_the_email(container);

		}).then(function(container) {

			return extract_data(container);

		}).then(function(container) {

			return copy_the_email(container);

		}).then(function(container) {

			return delete_the_email(container);

		}).then(function(container) {

			return true;

		}).catch(function(error) {

			console.error(error);

			return false;

		});

};

//	 _____    _____     ____    __  __   _____    _____   ______    _____
//	|  __ \  |  __ \   / __ \  |  \/  | |_   _|  / ____| |  ____|  / ____|
//	| |__) | | |__) | | |  | | | \  / |   | |   | (___   | |__    | (___
//	|  ___/  |  _  /  | |  | | | |\/| |   | |    \___ \  |  __|    \___ \
//	| |      | | \ \  | |__| | | |  | |  _| |_   ____) | | |____   ____) |
//	|_|      |_|  \_\  \____/  |_|  |_| |_____| |_____/  |______| |_____/
//

//
//	Load the email that we received from SES.
//
function load_the_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("load_the_email");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			Key: container.key
		};

		//
		//	->	Execute the query.
		//
		s3.getObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.error(params);
				return reject(error);
			}

			//
			//	2.	Save the email for the next promise
			//
			container.raw_email = data.Body

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}

//
//	Once the raw email is loaded we parse it with one goal in mind, get
//	the date the of the email. This way we don't rely on the SES date, but
//	on the real date the email was created.
//
//	This way we can even load in to the system old emails as long as they
//	are in the standard raw email format, and not some proprietary solution.
//
//	That why will be organized with the time the emails were created, and not
//	received in to the system.
//
function parse_the_email(container)
{
	return new Promise(function(resolve, reject) {

		//
		//	1.	Parse the email and extract all the it necessary.
		//
		parser(container.raw_email, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.error(data);
				return reject(error);
			}

			//
			//	2.	Save the parsed email for the next promise.
			//
			container.date			= data.date;
			container.from 			= data.from.value[0].address,
			container.to 			= data.to.value[0].address,
			container.subject		= data.subject,
			container.message_id	= data.messageId

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}

//
//	Extract all the data necessary to organize the incoming emails.
//
function extract_data(container)
{
	return new Promise(function(resolve, reject) {

		console.info("extract_data");

		//
		//	1.	Since the email string can come in a form of:
		//
		//			Name Last <name@example.com>
		//
		//		We have to extract just the email address, and discard
		//		the rest.
		//
		let tmp_to = 	container
						.to
						.match(/(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gm)[0]
						.split('@');

		let tmp_from = 	container
						.from
						.match(/(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gm)[0]
						.split('@');

		//
		//	2.	Get the domain name of the receiving end, so we can group
		//		emails by all the domain that were added to SES.
		//
		let to_domain = tmp_to[1];

		//
		//	3.	Based on the email name, we replace all the + characters, that
		//		can be used to organize ones on-line accounts in to /, this way
		//		we can build a S3 patch which will automatically organize
		//		all the email in structured folder.
		//
		let to_account = tmp_to[0].replace(/\+/g, "/");

		//
		//	4.	Get the domain name of the email which in our case will
		//		become the company name.
		//
		let from_domain = tmp_from[1];

		//
		//	5.	Get the name of who sent us the email.
		//
		let from_account = tmp_from[0];

		//
		//	6.	Create the path where the email needs to be moved
		//		so it is properly organized.
		//
		let path = 	"Inbox/"
					+ to_domain
					+ "/"
					+ to_account
					+ "/"
					+ from_domain
					+ "/"
					+ from_account
					+ "/"
					+ container.date
					+ " - "
					+ container.subject
					+ "/"
					+ "email";

		//
		//	7.	Save the path for the next promise.
		//
		container.path = path;

		//
		//	->	Move to the next chain.
		//
		return resolve(container);

	});
}

//
//	Copy the email to a new location - we don't put the email that we
//	already have in memory since the system requires a COPY action and not
//	a PUT action.
//
function copy_the_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("copy_the_email");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			CopySource: container.bucket + '/' + container.key,
			Key: container.path
		};

		//
		//	->	Execute the query.
		//
		s3.copyObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.error(params);
				return reject(error);
			}

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}

//
//	Delete the original message.
//
function delete_the_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("delete_the_email");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			Key: container.key
		};

		//
		//	->	Execute the query.
		//
		s3.deleteObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.error(params);
				return reject(error);
			}

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}