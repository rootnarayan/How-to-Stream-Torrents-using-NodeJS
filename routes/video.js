let fs = require("fs")
let path = require("path");
let express = require('express');
var WebTorrent = require('webtorrent')

let router = express.Router();

var client = new WebTorrent()

//
//	Test torrents
//
var tor_intel = 'magnet:?xt=urn:btih:6a9759bffd5c0af65319979fb7832189f4f3c35d&dn=sintel.mp4&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel-1024-surround.mp4'
var tor_depth = 'magnet:?xt=urn:btih:6fd85ac1a2193167810da8c60e92604aedd70fe5&dn=_______+%28Depth%29+Short+Film'
var tor_snowden = "magnet:?xt=urn:btih:f76ad565160789101bf986ba582d29584d9fee67&dn=Snowden"

var torrent = tor_snowden;

//
//	Add the torrent and start downloading it.
//
router.get('/add/:torrent', function(req, res) {

	//
	//	Add torrent to the queue
	//
	client.add(torrent, function (torrent) {

		//
		//	Extract the biggest file from the basket
		//
		let file = getLargestFile(torrent);

		//
		//	Emitted whenever data is uploaded. Useful for reporting the current
		//	torrent status.
		//
		torrent.on('upload', function() {

			//
			//	Detect when we have uploaded the torrent
			//
			if(torrent.length == torrent.downloaded)
			{
				//
				//	Destroy the client, including all torrents and connections
				//	to peers
				//
				torrent.destroy();
			}

		});

		//
		//	Emitted whenever data is downloaded. Useful for reporting the
		//	current torrent status, for instance:
		//
		torrent.on('download', function(bytes) {

			var percent 		= Math.round(torrent.progress * 100 * 100) / 100;
			var date 			= new Date(torrent.timeRemaining);
			let remaining 		= date.toLocaleTimeString()
			let downloadSpeed 	= torrent.downloadSpeed / 1024;
			let received 		= torrent.received / 1024

			console.log("%d Peers \t %s % \t %s remaining \t %s \t bytes/sec \t %s \t bytes", torrent.numPeers, percent, remaining, downloadSpeed, received)

		})

		//
		//	->	Just say it is ok.
		//
		res.status(200)
		res.end();

	});

});

//
//	Stream the video
//
router.get('/stream/:torrent', function(req, res, next) {

	//
	//	Returns the torrent with the given torrentId. Convenience method.
	//	Easier than searching through the client.torrents array. Returns null
	//	if no matching torrent found.
	//
	var tor = client.get(torrent);

	//
	//	Extract the biggest file from the basket
	//
	var file = getLargestFile(tor);

	//
	//	2.	Save the range the browser is asking for in a clear and
	//		reusable variable
	//
	//		The range tells us what part of the file the browser wants
	//		in bytes.
	//
	//		EXAMPLE: bytes=65534-33357823
	//
	let range = req.headers.range;

	//
	//	3.	Make sure the browser ask for a range to be sent.
	//
	if(!range)
	{
		//
		// 	1.	Create the error
		//
		let err = new Error("Wrong range");
			err.status = 416;

		//
		//	->	Send the error and stop the request.
		//
		return next(err);
	}

	//
	//	4.	Convert the string range in to an array for easy use.
	//
	let positions = range.replace(/bytes=/, "").split("-");

	//
	//	5.	Convert the start value in to an integer
	//
	let start = parseInt(positions[0], 10);

	//
	//	6.	Save the total file size in to a clear variable
	//
	let file_size = file.length;

	//
	//	7.	IF 		the end parameter is present we convert it in to an
	//				integer, the same way we did the start position
	//
	//		ELSE 	We use the file_size variable as the last part to be
	//				sent.
	//
	let end = positions[1] ? parseInt(positions[1], 10) : file_size - 1;

	//
	//	8.	Calculate the amount of bits will be sent back to the
	//		browser.
	//
	let chunksize = (end - start) + 1;

	//
	//	9.	Create the header for the video tag so it knows what is
	//		receiving.
	//
	let head = {
		"Content-Range": "bytes " + start + "-" + end + "/" + file_size,
		"Accept-Ranges": "bytes",
		"Content-Length": chunksize,
		"Content-Type": "video/mp4"
	}

	//
	//	10.	Send the custom header
	//
	res.writeHead(206, head);

	//
	//	11.	Create the createReadStream option object so createReadStream
	//		knows how much data it should be read from the file.
	//
	let stream_position = {
		start: start,
		end: end
	}

	//
	//	12.	Create a stream chunk based on what the browser asked us for
	//
	let stream = file.createReadStream(stream_position)

	stream.pipe(res);

	//
	//	->	If there was an error while opening a stream we stop the
	//		request and display it.
	//
	stream.on("error", function(err) {

		return next(err);

	});

});

//
//	Delete torrent
//
router.get('/delete/:torrent', function(req, res, next) {

	//
	//	Remove a torrent from the client. Destroy all connections to peers
	//	and delete all saved file data. If callback is specified, it will be
	//	called when file data is removed.
	//
	var tor = client.remove(torrent);

	res.status(200);
	res.end();

});

//
//
//
function getLargestFile(torrent) {

	let file;

	for(i = 0; i < torrent.files.length; i++)
	{
		if (!file || file.length < torrent.files[i].length)
		{
			file = torrent.files[i];
		}
	}

	return file;
}

module.exports = router;
