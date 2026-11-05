import { readFile } from 'node:fs/promises';
import path from 'node:path';
import tableEngine from '../table-engine.js';

const { recognizeTable } = tableEngine;

const samples = [
  {
    file: 'G:\\SK\\OneDrive\\Desktop\\sir questions\\table.png',
    expected: ['Store', 'Total Bags Distributed', 'Jute : Plastic', 'Printed : Plain', '420', '2:1', '(x:3)'],
  },
  {
    file: 'G:\\SK\\OneDrive\\Desktop\\sir questions\\table_new.png',
    expected: [
      'Blood Donation Camp',
      'Total Persons Registered',
      'Eligible Persons',
      'Percentage of Eligible Persons Who Donated',
      '1200',
      '3:2',
      '75%',
      '40P',
      'P:10',
    ],
  },
];

for (const sample of samples) {
  const buffer = await readFile(sample.file);
  const result = await recognizeTable(buffer, {
    language: 'eng',
    onProgress: ({ status, progress }) => {
      const percent = Math.round((progress || 0) * 100);
      if (percent % 20 === 0) console.log(`${status} ${percent}%`);
    },
  });

  if (!result.ok) {
    console.error(`FAIL ${path.basename(sample.file)}: ${result.reason}`);
    process.exitCode = 1;
    continue;
  }

  console.log(`--- ${path.basename(sample.file)} ---`);
  console.log(result.table.markdown);
  console.log(result.table.tsv);

  const missing = sample.expected.filter((value) => !result.table.markdown.includes(value));
  if (missing.length) {
    console.error(`FAIL ${path.basename(sample.file)}: missing ${missing.join(', ')}`);
    process.exitCode = 1;
  } else if (result.table.rows !== 6 || result.table.columns !== 4) {
    console.error(
      `FAIL ${path.basename(sample.file)}: expected 6 rows x 4 columns, got ${result.table.rows} x ${result.table.columns}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`PASS ${path.basename(sample.file)}: 6 rows x 4 columns`);
  }
}
