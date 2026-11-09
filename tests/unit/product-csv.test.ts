import { describe, expect, it } from "vitest";
import { csvToProductRows, parseCsv } from "@/features/products/csv";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["d", "e", "f"],
    ]);
  });

  it("keeps newlines inside quotes and ignores blank lines", () => {
    expect(parseCsv('a,"x\ny"\n\n')).toEqual([["a", "x\ny"]]);
  });
});

describe("csvToProductRows", () => {
  it("maps columns, drops blanks and splits applications", () => {
    const rows = csvToProductRows(
      "name,slug,code,casNumber,category,description,sourceNote,applications\n" +
        '"Padma, special",,,101-48-4,Aroma Chemicals,,note,Soap; Candles\n',
    );
    expect(rows).toEqual([
      {
        name: "Padma, special",
        casNumber: "101-48-4",
        category: "Aroma Chemicals",
        sourceNote: "note",
        applications: ["Soap", "Candles"],
      },
    ]);
  });
});

describe("csv edge cases", () => {
  it("ignores a leading BOM in the header", () => {
    expect(csvToProductRows("\u{FEFF}name,casNumber\nPadma,101-48-4\n")).toEqual([
      { name: "Padma", casNumber: "101-48-4" },
    ]);
  });

  it("tolerates a ragged row with fewer cells than the header", () => {
    expect(csvToProductRows("name,casNumber,category\nPadma\n")).toEqual([{ name: "Padma" }]);
  });
});
