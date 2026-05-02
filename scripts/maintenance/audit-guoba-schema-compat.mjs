import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(pluginRoot, '..', '..');

const supportedComponents = new Set([
  'Alert',
  'ApiCascader',
  'ApiRadioGroup',
  'ApiSelect',
  'ApiTransfer',
  'ApiTree',
  'ApiTreeSelect',
  'AutoComplete',
  'Cascader',
  'Checkbox',
  'CheckboxGroup',
  'DatePicker',
  'Divider',
  'EasyCron',
  'GButtons',
  'GColorPicker',
  'GSelectFriend',
  'GSelectGroup',
  'GSubForm',
  'GTags',
  'IconPicker',
  'Input',
  'Input.TextArea',
  'InputCountDown',
  'InputGroup',
  'InputNumber',
  'InputPassword',
  'InputSearch',
  'InputTextArea',
  'Mentions',
  'MonthPicker',
  'RadioButtonGroup',
  'RadioGroup',
  'RangePicker',
  'Rate',
  'Render',
  'Select',
  'Segmented',
  'Slider',
  'SOFT_GROUP_BEGIN',
  'StrengthMeter',
  'Switch',
  'Textarea',
  'TimePicker',
  'TreeSelect',
  'Upload',
  'WeekPicker',
]);

function resolveScanRoot() {
  const input = process.argv[2];
  if (!input) {
    return path.join(workspaceRoot, 'plugins');
  }
  return path.resolve(process.cwd(), input);
}

function walkDir(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      walkDir(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name === 'guoba.support.js') {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function parseComponents(code) {
  const components = [];
  const normalized = stripComments(code);
  const pattern = /component:\s*['"]([A-Za-z0-9._]+)['"]/g;
  let match = pattern.exec(normalized);
  while (match) {
    components.push(match[1]);
    match = pattern.exec(normalized);
  }
  return components;
}

function collectUsage(files) {
  const componentCountMap = new Map();
  const unsupportedFiles = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const components = parseComponents(content);
    const unsupported = [];

    for (const component of components) {
      componentCountMap.set(component, (componentCountMap.get(component) ?? 0) + 1);
      if (!supportedComponents.has(component)) {
        unsupported.push(component);
      }
    }

    if (unsupported.length > 0) {
      unsupportedFiles.push({
        file,
        unsupported: [...new Set(unsupported)].sort(),
      });
    }
  }

  return { componentCountMap, unsupportedFiles };
}

function printSummary(scanRoot, files, componentCountMap, unsupportedFiles) {
  console.log(`[guoba-schema-audit] scan root: ${scanRoot}`);
  console.log(`[guoba-schema-audit] files: ${files.length}`);
  console.log('[guoba-schema-audit] detected components:');

  for (const [component, count] of [...componentCountMap.entries()].sort((a, b) => {
    return a[0].localeCompare(b[0]);
  })) {
    console.log(`  - ${component}: ${count}`);
  }

  if (unsupportedFiles.length === 0) {
    console.log('[guoba-schema-audit] result: all detected components are supported');
    return;
  }

  console.log('[guoba-schema-audit] unsupported components found:');
  for (const item of unsupportedFiles) {
    const relativePath = path.relative(workspaceRoot, item.file);
    console.log(`  - ${relativePath}: ${item.unsupported.join(', ')}`);
  }
}

function main() {
  const scanRoot = resolveScanRoot();
  if (!fs.existsSync(scanRoot)) {
    console.error(`[guoba-schema-audit] scan root not found: ${scanRoot}`);
    process.exitCode = 1;
    return;
  }

  const files = walkDir(scanRoot);
  const { componentCountMap, unsupportedFiles } = collectUsage(files);
  printSummary(scanRoot, files, componentCountMap, unsupportedFiles);

  if (unsupportedFiles.length > 0) {
    process.exitCode = 1;
  }
}

main();
