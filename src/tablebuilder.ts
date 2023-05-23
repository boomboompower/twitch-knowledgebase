/**
 * A very basic markdown table builder.
 */
export default class TableBuilder {

    private readonly titles: string[]
    private readonly titleLengths: number[]

    private readonly rows: string[][]

    /**
     * The title rows for the table.
     *
     * @param titles, e.g "Name", "Description"
     */
    constructor(...titles: string[]) {
        this.titles = titles;
        this.titleLengths = [];
        this.rows = []

        for (let i = 0; i < titles.length; i++) {
            this.titleLengths.push(titles[i].length + 2);
        }
    }

    /**
     * Adds a row to this table, each parameter represents a column on the table
     *
     * @param values a list of columns of data for this row. must match the table title count.
     */
    insertRow(...values: string[]) : void {
        if (values.length !== this.titles.length) {
            throw new Error('Value length must match title length')
        }

        // resize the table
        for (let i = 0; i < values.length; i++) {
            // +2 for the whitespace characters
            if (values[i].length + 2 > this.titleLengths[i]) {
                this.titleLengths[i] = values[i].length + 2;
            }
        }

        // add to rows
        this.rows.push([...values])
    }

    /**
     * Builds this table to a markdown represented value
     */
    build() : string {
        // primitive obsession, use a string builder to create the table.
        let building = '';

        // add the title | Name | Description |
        for (let i = 0; i < this.titles.length; i++) {
            building += '| ';
            building += this.titles[i] + ' '.repeat(this.titleLengths[i] - this.titles[i].length - 1);
        }

        building += ' |';
        building += '\n';

        // add the table separator
        // |----|-------|---|
        for (let i = 0; i < this.titles.length; i++) {
            building += '|';
            building += '-'.repeat(this.titleLengths[i]);
        }

        building += '-|';
        building += '\n';

        // iterate through the values on the table
        for (let i = 0; i < this.rows.length; i++) {
            // this row
            const row = this.rows[i];

            // iterate through columns of this row
            for (let i = 0; i < row.length; i++) {
                const value = row[i];
                // get the expected length of this row
                const titleLength = this.titleLengths[i]

                building += '| ';
                building += value;
                // add the spaces
                building += ' '.repeat(titleLength - value.length - 2);
                building += ' ';
            }

            building += ' |';
            building += '\n';
        }

        building += '\n';

        // return the built table string
        return building;
    }
}
