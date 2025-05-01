import promptSync from 'prompt-sync';
import { writeFileSync, readFileSync } from 'fs';
import { EventSource } from 'eventsource';

const getLastMessageIdFile = topicId => {
	return `./last_message_id_${topicId}.txt`;
};

const getTopicIdFromUser = () => {
	const prompt = promptSync();
	const topicId = prompt('Enter the topicId you want to subscribe to: ');
	if (!topicId) {
		console.log('No topicId entered. Subscription cancelled.');
		return null;
	}
	return topicId;
};

const getLastIdxForTopic = topicId => {
	const lastMessageIdFile = getLastMessageIdFile(topicId);
	try {
		const data = readFileSync(lastMessageIdFile, 'utf8');
		const lastIdx = parseInt(data.trim(), 10);
		return isNaN(lastIdx) ? null : lastIdx;
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.error(
				`File ${lastMessageIdFile} not found. Starting from scratch.`
			);
			return null;
		}
		console.error(`Error reading file ${lastMessageIdFile}:`, err);
		return null;
	}
};

const writeLastIdxForTopic = (topicId, idx) => {
	const lastMessageIdFile = getLastMessageIdFile(topicId);
	try {
		writeFileSync(lastMessageIdFile, idx.toString());
	} catch (err) {
		console.error(`Error writing to file ${lastMessageIdFile}:`, err);
	}
};

const subscribeToTopic = topicId => {
	if (!topicId) return;

	const lastIdx = getLastIdxForTopic(topicId);
	if (lastIdx !== null) {
		console.log(`Resuming from last message ID: ${lastIdx}`);
	}

	const evtSource = new EventSource(
		`http://localhost:3000/events?topic_id=${encodeURIComponent(topicId)}${
			lastIdx ? `&idx=${lastIdx}` : ''
		}`
	);

	evtSource.onmessage = event => {
		if (!event.data) {
			console.log('No data received.');
			return;
		}
		if (typeof event.data !== 'string') {
			console.log('Invalid data format:', typeof event.data);
			return;
		}
		const [_, idx, message] = event.data.match(/IDX=(\d+),MSG=(.*)/) ?? [];
		if (!idx || !message) {
			console.log(event.data);
			return;
		}
		console.log(message);
		writeLastIdxForTopic(topicId, idx);
	};

	evtSource.onopen = () => {
		console.log('Connection to server opened.');
		console.log('');
		console.log(' ...... start ... of ... SSE ... ');
	};

	evtSource.onerror = err => {
		console.error('EventSource failed:', err);
	};
};

subscribeToTopic(getTopicIdFromUser());
