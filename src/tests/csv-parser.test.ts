import { describe, it } from "vitest";
import assert from "node:assert";
import { parseDelimitedText } from "../utils/csv-parser.ts";
import { autoDetectColumnMapping } from "../utils/column-mapper.ts";

describe("Frontend CSV Parser & Fuzzy Column Mapper (Prompt 05)", () => {
  it("parses RFC 4180 CSV with quotes, commas in values, and escaped quotes", () => {
    const csvContent = `Email,Full Name,Department,Notes
"john.doe@company.com","Doe, John","Engineering, Core","He said ""Hello world"""
"sarah@company.com","Sarah Connor","Robotics","Top performer"`;

    const result = parseDelimitedText(csvContent);
    assert.deepStrictEqual(result.headers, ["Email", "Full Name", "Department", "Notes"]);
    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[0]["Full Name"], "Doe, John");
    assert.strictEqual(result.rows[0]["Department"], "Engineering, Core");
    assert.strictEqual(result.rows[0]["Notes"], 'He said "Hello world"');
    assert.strictEqual(result.rows[1]["Email"], "sarah@company.com");
  });

  it("auto-detects semicolon and tab delimiters", () => {
    const tsvContent = `Email\tFull Name\tDepartment\nalice@company.com\tAlice Smith\tDesign`;
    const tsvResult = parseDelimitedText(tsvContent);
    assert.strictEqual(tsvResult.delimiter, "\t");
    assert.strictEqual(tsvResult.rows.length, 1);
    assert.strictEqual(tsvResult.rows[0]["Full Name"], "Alice Smith");

    const semiContent = `Email;Full Name;Department\nbob@company.com;Bob Smith;Finance`;
    const semiResult = parseDelimitedText(semiContent);
    assert.strictEqual(semiResult.delimiter, ";");
    assert.strictEqual(semiResult.rows.length, 1);
    assert.strictEqual(semiResult.rows[0]["Department"], "Finance");
  });

  it("strips UTF-8 Byte Order Mark (BOM)", () => {
    const bomCsv = `\uFEFFEmail,Name\ntest@company.com,Test User`;
    const result = parseDelimitedText(bomCsv);
    assert.strictEqual(result.headers[0], "Email");
    assert.strictEqual(result.rows[0]["Email"], "test@company.com");
  });

  it("fuzzy maps non-standard corporate headers to canonical Talnova fields", () => {
    const rawHeaders = [
      "Staff Email",
      "Worker Name",
      "Dept",
      "Position",
      "Reports To",
      "Joining Date",
      "Access Level",
    ];

    const mapping = autoDetectColumnMapping(rawHeaders);
    assert.strictEqual(mapping["Staff Email"], "email");
    assert.strictEqual(mapping["Worker Name"], "fullName");
    assert.strictEqual(mapping["Dept"], "department");
    assert.strictEqual(mapping["Position"], "jobTitle");
    assert.strictEqual(mapping["Reports To"], "managerEmail");
    assert.strictEqual(mapping["Joining Date"], "hireDate");
    assert.strictEqual(mapping["Access Level"], "role");
  });
});
