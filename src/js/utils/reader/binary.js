export class BinaryReader {

    /** @type {DataView} buffer */
    constructor(buffer) {
        this.buffer = buffer || null;
    }

    to_array_buffer = (buffer) => {
        const arrayBuffer = new ArrayBuffer(buffer.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < buffer.length; ++i) {
            view[i] = buffer[i];
        }
        return arrayBuffer;
    }

    set_buffer = (buf) => {
        this.buffer = new DataView(this.to_array_buffer(buf));
    }

    byte(s) {
        const value = !s ? this.buffer.getUint8(this.offset) : this.buffer.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    short(s) {
        const value = !s ? this.buffer.getUint16(this.offset, true) : this.buffer.getInt16(this.offset, true);
        this.offset += 2; 
        return value;
    }

    int(s) {
        const value = !s ? this.buffer.getUint32(this.offset, true) : this.buffer.getInt32(this.offset, true);
        this.offset += 4;     
        return value;
    }

    long(s) {
        const value = !s ? this.buffer.getBigUint64(this.offset, true) : this.buffer.getBigInt64(this.offset, true);
        this.offset += 8;       
        return value;
    }

    uleb() {
        let result = 0;
        let shift = 0;

        do {
            const byte = this.byte();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (this.buffer.getUint8(this.offset - 1) & 0x80);
            
        return { value: result, bytesRead: this.offset };
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
        return this.byte() !== 0x00;
    }

    string() {

        const is_present = this.bool();

        if (!is_present) {
            return null;
        }

        const length = this.uleb();

        const buffer = new Uint8Array(this.buffer.buffer, this.offset, length.value);
        const decoder = new TextDecoder('utf-8');
        const value = decoder.decode(buffer);

        this.offset += length.value;

        return value;
    }

    string2() {

        const length = this.uleb();

        const buffer = new Uint8Array(this.buffer.buffer, this.offset, length.value);
        const decoder = new TextDecoder('utf-8');
        const value = decoder.decode(buffer);

        this.offset += length.value;

        return value;
    }

    writeByte(value) {
        const buffer = new Uint8Array(1);
        buffer[0] = value;
        return buffer;
    }
    
    writeInt(value) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setUint32(0, value, true);
        return new Uint8Array(buffer);
    }
    
    writeLong(value) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, BigInt(value), true);
        return new Uint8Array(buffer);
    }
    
    writeBool(value) {
        return this.writeByte(value ? 0x01 : 0x00);
    }
    
    writeString(value) {

        if (value == null) {
            return this.writeByte(0x00);
        }

        const stringBuffer = new TextEncoder().encode(value);
        const lengthBuffer = this.writeULEB128(stringBuffer.byteLength);
        const resultBuffer = new Uint8Array(lengthBuffer.byteLength + stringBuffer.byteLength + 1);

        resultBuffer.set(new Uint8Array([0x0B]), 0);
        resultBuffer.set(new Uint8Array(lengthBuffer), 1);
        resultBuffer.set(new Uint8Array(stringBuffer), 1 + lengthBuffer.byteLength);

        return resultBuffer.buffer;
    }
    
    writeULEB128(value) {
        const buffer = new ArrayBuffer(5);
        const dataView = new DataView(buffer);
        let offset = 0;

        do {
            let byte = value & 0x7F;
            value >>>= 7;
            if (value != 0) { /* more bytes to come */
                byte |= 0x80;
            }
            dataView.setUint8(offset++, byte);
        } while (value != 0);

        return buffer.slice(0, offset); // remove unused bytes
    }

    join_buffer(buffers) {
        let total_length = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
        let result = new Uint8Array(total_length);
        let offset = 0;
        for (let buffer of buffers) {
            result.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        }
        return result;
    }
}
