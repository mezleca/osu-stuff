export const safe_text = (text) => {
	if (!text) {
		return "";
	}

	return String(text).replace(/[<>&"']/g, (char) => {
		switch (char) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
			default:
				return char;
		}
	});
};

export const safe_id = (id) => {
	return String(id).replace(/[^\w-]/g, "");
};

export const star_ranges = [
	[0, 2.99, "sr1"],
	[3, 4.99, "sr2"],
	[5, 6.99, "sr3"],
	[7, 7.99, "sr4"],
	[8, 8.99, "sr5"],
	[9, Infinity, "sr6"]
];

export const debounce = (func, timeout = 100) => {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => func(...args), timeout);
	};
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
