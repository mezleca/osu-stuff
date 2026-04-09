export class BinaryReader {
    protected buffer: Buffer = Buffer.alloc(0);
    protected offset: number = 0;

    protected set_buffer = (buffer: Buffer): void => {
        this.buffer = Buffer.from(buffer);
        this.offset = 0;
    };

    protected get_remaining = (): number => {
        return this.buffer.length - this.offset;
    };

    protected ensure_available = (bytes: number): void => {
        if (bytes < 0) {
            throw new Error("invalid read size");
        }

        if (this.get_remaining() < bytes) {
            throw new Error(`unexpected eof at offset=${this.offset}, need=${bytes}, remaining=${this.get_remaining()}`);
        }
    };

    protected skip = (bytes: number): void => {
        this.ensure_available(bytes);
        this.offset += bytes;
    };

    protected byte = (signed: boolean = false): number => {
        this.ensure_available(1);
        const value = signed ? this.buffer.readInt8(this.offset) : this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return value;
    };

    protected short = (signed: boolean = false): number => {
        this.ensure_available(2);
        const value = signed ? this.buffer.readInt16LE(this.offset) : this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return value;
    };

    protected int = (signed: boolean = false): number => {
        this.ensure_available(4);
        const value = signed ? this.buffer.readInt32LE(this.offset) : this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value;
    };

    protected long = (signed: boolean = false): bigint => {
        this.ensure_available(8);
        const value = signed ? this.buffer.readBigInt64LE(this.offset) : this.buffer.readBigUInt64LE(this.offset);
        this.offset += 8;
        return value;
    };

    protected single = (): number => {
        this.ensure_available(4);
        const value = this.buffer.readFloatLE(this.offset);
        this.offset += 4;
        return value;
    };

    protected double = (): number => {
        this.ensure_available(8);
        const value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8;
        return value;
    };

    protected bool = (): boolean => {
        return this.byte() != 0;
    };

    protected uleb = (): number => {
        let result = 0;
        let shift = 0;

        for (let i = 0; i < 5; i++) {
            const current = this.byte();
            result |= (current & 0x7f) << shift;

            if ((current & 0x80) == 0) {
                return result >>> 0;
            }

            shift += 7;
        }

        throw new Error("invalid uleb128 sequence");
    };

    protected osu_string = (): string => {
        const marker = this.byte();

        if (marker == 0x00) {
            return "";
        }

        if (marker != 0x0b) {
            throw new Error(`invalid osu string marker: 0x${marker.toString(16)}`);
        }

        const length = this.uleb();
        this.ensure_available(length);

        const value = this.buffer.subarray(this.offset, this.offset + length).toString("utf8");
        this.offset += length;

        return value;
    };

    protected plain_string = (): string => {
        const length = this.uleb();
        this.ensure_available(length);

        const value = this.buffer.subarray(this.offset, this.offset + length).toString("utf8");
        this.offset += length;

        return value;
    };

    protected write_byte = (value: number): Buffer => {
        const buffer = Buffer.allocUnsafe(1);
        buffer.writeUInt8(value, 0);
        return buffer;
    };

    protected write_int = (value: number): Buffer => {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeUInt32LE(value >>> 0, 0);
        return buffer;
    };

    protected write_long = (value: bigint | number): Buffer => {
        const buffer = Buffer.allocUnsafe(8);
        buffer.writeBigUInt64LE(BigInt(value), 0);
        return buffer;
    };

    protected write_double = (value: number): Buffer => {
        const buffer = Buffer.allocUnsafe(8);
        buffer.writeDoubleLE(value, 0);
        return buffer;
    };

    protected write_uleb = (value: number): Buffer => {
        const bytes: number[] = [];
        let remaining = value >>> 0;

        do {
            let next = remaining & 0x7f;
            remaining >>>= 7;

            if (remaining != 0) {
                next |= 0x80;
            }

            bytes.push(next);
        } while (remaining != 0);

        return Buffer.from(bytes);
    };

    protected write_osu_string = (value: string): Buffer => {
        if (!value) {
            return Buffer.from([0x00]);
        }

        const raw = Buffer.from(value, "utf8");
        const length = this.write_uleb(raw.length);
        return Buffer.concat([Buffer.from([0x0b]), length, raw]);
    };

    protected write_plain_string = (value: string): Buffer => {
        const raw = Buffer.from(value ?? "", "utf8");
        const length = this.write_uleb(raw.length);
        return Buffer.concat([length, raw]);
    };

    protected join_buffer = (buffers: Buffer[]): Buffer => {
        return Buffer.concat(buffers);
    };
}
