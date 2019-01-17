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
		let tmp_to = container.to.split('@');
		let tmp_from = 	container
						.from.match(/[^< ]+(?=>)/g)[0]
						.split('@');

		//
		//	2.	Get the domain name of the receiving end, so we can group
		//		emails by all the domain that were added to SES.
		//
		let to_domain = tmp_to[1];

		//
		//	3.	Get the email name where the email is directed to.
		//
		let user_name = tmp_to[0];

		//
		//	4.	Based on the email name, we replace all the + characters, that
		//		can be used to organize ones on-line accounts in to /, this way
		//		we can build a S3 patch which will automatically organize
		//		all the email in structured folder.
		//
		let to_path = user_name.replace(/\+/g, "/");

		//
		//	5.	Get the domain name of the email which in our case will
		//		become the company name.
		//
		let company_name = tmp_from[1];

		//
		//	6.	Get the name of who sent us the email.
		//
		let company_account = tmp_from[0];

		//
		//	7.	Create the path where the email needs to be moved
		//		so it is properly organized.
		//
		let path = 	to_domain
					+ "/Inbox/"
					+ to_path
					+ "/"
					+ company_name
					+ "/"
					+ company_account
					+ "/"
					+ container.date
					+ " - "
					+ container.subject

		//
		//	8.	Save the path for the next promise.
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
			CopySource: process.env.BUCKET + "/_inbound/" + container.message_id,
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
			Key: "_inbound/" + container.message_id
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