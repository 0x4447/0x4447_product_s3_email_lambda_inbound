let AWS = require('aws-sdk');

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
	//	1.	This JS object will contain all the data within the chain.
	//
	let container = {
		from: event.Records[0].ses.mail.commonHeaders.from[0],
		to: event.Records[0].ses.mail.commonHeaders.to[0],
		subject: event.Records[0].ses.mail.commonHeaders.subject,
		date: event.Records[0].ses.mail.commonHeaders.date,
		message_id: event.Records[0].ses.mail.messageId
	}

	console.log(container);

	//
	//	->	Start the chain.
	//
	extract_data(container)
		.then(function(container) {

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
//	Extract all the data necessary to organize the incoming emails.
//
function extract_data(container)
{
	return new Promise(function(resolve, reject) {

		console.info("extract_data");

		//
		//	1.	Extract all the information
		//
		let tmp_to = 	container
						.to
						.match(/[a-z0-9-+]{1,30}@[a-z0-9-]{1,65}.[a-z]{1,}/gm)[0]
						.split('@');

		let tmp_from = 	container
						.from
						.match(/[a-z0-9-+]{1,30}@[a-z0-9-]{1,65}.[a-z]{1,}/gm)[0]
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
//	Copy the email to a new location.
//
function copy_the_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("copy_the_email");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: process.env.BUCKET,
			CopySource: process.env.BUCKET + "/TMP/email_in/" + container.message_id,
			Key: container.path
		};

		console.log(params);

		//
		//	->	Execute the query.
		//
		s3.copyObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
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
			Bucket: process.env.BUCKET,
			Key: "TMP/email_in/" + container.message_id
		};

		console.log(params)


		//
		//	->	Execute the query.
		//
		s3.deleteObject(params, function(error, data) {

			console.log(error)
			console.log(data)

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				return reject(error);
			}

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}