const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

export class BinaryReader {
	constructor(buffer) {
		this.offset = 0;
		if (buffer) {
			this.set_buffer(buffer);
		}
	}

	set_buffer = (buf) => {
		if (buf instanceof ArrayBuffer) {
			this.buffer = new DataView(buf);
			this.uint8View = new Uint8Array(buf);
		} else {
			this.buffer = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
			this.uint8View = buf;
		}

		this.offset = 0;
	};

	byte(signed = false) {
		const value = signed ? this.buffer.getInt8(this.offset) : this.uint8View[this.offset];
		this.offset += 1;
		return value;
	}

	short(signed = false) {
		const value = signed ? this.buffer.getInt16(this.offset, true) : this.buffer.getUint16(this.offset, true);
		this.offset += 2;
		return value;
	}

	int(signed = false) {
		const value = signed ? this.buffer.getInt32(this.offset, true) : this.buffer.getUint32(this.offset, true);
		this.offset += 4;
		return value;
	}

	long(signed = false) {
		const value = signed ? this.buffer.getBigInt64(this.offset, true) : this.buffer.getBigUint64(this.offset, true);
		this.offset += 8;
		return value;
	}

	uleb() {
		let result = 0;
		let shift = 0;
		let start = this.offset;

		while (true) {
			const byte = this.uint8View[this.offset++];
			result |= (byte & 0x7f) << shift;

			if ((byte & 0x80) === 0) {
				break;
			}
			shift += 7;
		}

		return { value: result, bytesRead: this.offset - start };
	}

	single() {
		const value = this.buffer.getFloat32(this.offset, true);
		this.offset += 4;
		return value;
	}

	double() {
		const value = this.buffer.getFloat64(this.offset, true);
		this.offset += 8;
		return value;
	}

	bool() {
		return this.uint8View[this.offset++] != 0x00;
	}

	string() {
		const is_present = this.bool();

		if (!is_present) {
			return null;
		}

		const length = this.uleb();
		const bytes = this.uint8View.subarray(this.offset, this.offset + length.value);
		const value = decoder.decode(bytes);

		this.offset += length.value;

		return value;
	}

	string2() {
		const length = this.uleb();
		const stringBytes = this.uint8View.subarray(this.offset, this.offset + length.value);
		const value = decoder.decode(stringBytes);
		this.offset += length.value;

		return value;
	}

	writeByte(value) {
		return new Uint8Array([value]);
	}

	writeInt(value) {
		const buffer = new Uint8Array(4);
		const view = new DataView(buffer.buffer);
		view.setUint32(0, value, true);
		return buffer;
	}

	writeLong(value) {
		const buffer = new Uint8Array(8);
		const view = new DataView(buffer.buffer);
		view.setBigUint64(0, BigInt(value), true);
		return buffer;
	}

	writeBool(value) {
		return new Uint8Array([value ? 0x01 : 0x00]);
	}

	writeDouble(value) {
		const buffer = new Uint8Array(8);
		const view = new DataView(buffer.buffer);
		view.setFloat64(0, value, true);
		return buffer;
	}

	writeULEB128(value) {
		const bytes = [];

		do {
			let byte = value & 0x7f;
			value >>>= 7;

			if (value != 0) {
				byte |= 0x80;
			}

			bytes.push(byte);
		} while (value != 0);

		return new Uint8Array(bytes);
	}

	writeString(value) {
		if (value == null) {
			return new Uint8Array([0x00]);
		}

		const stringBuffer = encoder.encode(value);
		const lengthBuffer = this.writeULEB128(stringBuffer.byteLength);
		const resultBuffer = new Uint8Array(lengthBuffer.byteLength + stringBuffer.byteLength + 1);

		resultBuffer[0] = 0x0b;
		resultBuffer.set(lengthBuffer, 1);
		resultBuffer.set(stringBuffer, 1 + lengthBuffer.byteLength);

		return resultBuffer;
	}

	writeString2(value) {
		const stringBuffer = encoder.encode(value);
		const lengthBuffer = this.writeULEB128(stringBuffer.byteLength);
		const result = new Uint8Array(lengthBuffer.byteLength + stringBuffer.byteLength);

		result.set(lengthBuffer, 0);
		result.set(stringBuffer, lengthBuffer.byteLength);

		return result;
	}
	join_buffer(buffers) {
		let length = 0;

		for (const buffer of buffers) {
			length += buffer.byteLength || buffer.length;
		}

		const result = new Uint8Array(length);
		let offset = 0;

		for (const buffer of buffers) {
			if (buffer instanceof Uint8Array) {
				result.set(buffer, offset);
				offset += buffer.byteLength;
			} else if (buffer.buffer) {
				const view = new Uint8Array(buffer.buffer);
				result.set(view, offset);
				offset += view.byteLength;
			} else {
				result.set(buffer, offset);
				offset += buffer.length;
			}
		}

		return result;
	}

	skip(bytes) {
		this.offset += bytes;
	}
}
