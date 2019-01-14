//
//	This Lambda will filter all the incoming emails based on their From and To
//	field.
//
exports.handler = async (event) => {

	let from = event.Records[0].ses.mail.commonHeaders.from[0];
	let to = event.Records[0].ses.mail.commonHeaders.to[0];
	let date = event.Records[0].ses.mail.commonHeaders.date;
	let message_id = event.Records[0].ses.mail.messageId;

	console.log("From: ", from);
	console.log("to: ", to);
	console.log("date: ", date);
	console.log("message_id: ", message_id);

	//
	//	->	Return a positive response
	//
	return true;

};
