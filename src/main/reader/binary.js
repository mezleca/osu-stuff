export class BinaryReader {
	constructor(buffer) {
		this.offset = 0;
		if (buffer) {
			this.set_buffer(buffer);
		}
	}

	set_buffer = (buf) => {
		this.buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
		this.offset = 0;
	};

	byte(signed = false) {
		return signed ? this.buffer.readInt8(this.offset++) : this.buffer.readUInt8(this.offset++);
	}

	short(signed = false) {
		const value = signed ? this.buffer.readInt16LE(this.offset) : this.buffer.readUInt16LE(this.offset);
		this.offset += 2;
		return value;
	}

	int(signed = false) {
		const value = signed ? this.buffer.readInt32LE(this.offset) : this.buffer.readUInt32LE(this.offset);
		this.offset += 4;
		return value;
	}

	long(signed = false) {
		const value = signed ? this.buffer.readBigInt64LE(this.offset) : this.buffer.readBigUInt64LE(this.offset);
		this.offset += 8;
		return value;
	}

	uleb() {
		let result = 0;
		let shift = 0;
		const start = this.offset;

		for (let i = 0; i < 5; i++) {
			const byte = this.buffer.readUInt8(this.offset++);
			result |= (byte & 0x7f) << shift;

			if ((byte & 0x80) === 0) {
				break;
			}
			shift += 7;
		}

		return { value: result, bytesRead: this.offset - start };
	}

	single() {
		const value = this.buffer.readFloatLE(this.offset);
		this.offset += 4;
		return value;
	}

	double() {
		const value = this.buffer.readDoubleLE(this.offset);
		this.offset += 8;
		return value;
	}

	bool() {
		return this.buffer.readUInt8(this.offset++) !== 0x00;
	}

	string() {
		const is_present = this.bool();

		if (!is_present) {
			return null;
		}

		const length = this.uleb();
		const value = this.buffer.subarray(this.offset, this.offset + length.value).toString("utf8");
		this.offset += length.value;

		return value;
	}

	string2() {
		const length = this.uleb();
		const value = this.buffer.subarray(this.offset, this.offset + length.value).toString("utf8");
		this.offset += length.value;

		return value;
	}

	writeByte(value) {
		const buffer = Buffer.allocUnsafe(1);
		buffer.writeUInt8(value, 0);
		return buffer;
	}

	writeInt(value) {
		const buffer = Buffer.allocUnsafe(4);
		buffer.writeUInt32LE(value, 0);
		return buffer;
	}

	writeLong(value) {
		const buffer = Buffer.allocUnsafe(8);
		buffer.writeBigUInt64LE(BigInt(value), 0);
		return buffer;
	}

	writeBool(value) {
		const buffer = Buffer.allocUnsafe(1);
		buffer.writeUInt8(value ? 0x01 : 0x00, 0);
		return buffer;
	}

	writeDouble(value) {
		const buffer = Buffer.allocUnsafe(8);
		buffer.writeDoubleLE(value, 0);
		return buffer;
	}

	writeULEB128(value) {
		const bytes = [];

		do {
			let byte = value & 0x7f;
			value >>>= 7;

			if (value !== 0) {
				byte |= 0x80;
			}

			bytes.push(byte);
		} while (value !== 0);

		return Buffer.from(bytes);
	}

	writeString(value) {
		if (value == null) {
			return Buffer.from([0x00]);
		}

		const string_buffer = Buffer.from(value, "utf8");
		const length_buffer = this.writeULEB128(string_buffer.byteLength);
		const result = Buffer.allocUnsafe(length_buffer.byteLength + string_buffer.byteLength + 1);

		result.writeUInt8(0x0b, 0);
		length_buffer.copy(result, 1);
		string_buffer.copy(result, 1 + length_buffer.byteLength);

		return result;
	}

	writeString2(value) {
		const string_buffer = Buffer.from(value, "utf8");
		const length_buffer = this.writeULEB128(string_buffer.byteLength);
		const result = Buffer.allocUnsafe(length_buffer.byteLength + string_buffer.byteLength);

		length_buffer.copy(result, 0);
		string_buffer.copy(result, length_buffer.byteLength);

		return result;
	}

	join_buffer(buffers) {
		return Buffer.concat(buffers);
	}

	skip(bytes) {
		this.offset += bytes;
	}
}
