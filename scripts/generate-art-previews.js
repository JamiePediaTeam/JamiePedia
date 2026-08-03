const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const INPUT_GROUPS = [
  {
    key: 'cover-art',
    inputDir: path.join(ROOT, 'public', 'images', 'cover-art'),
    outputDir: path.join(ROOT, 'public', 'images', 'previews', 'cover-art')
  },
  {
    key: 'motif-art',
    inputDir: path.join(ROOT, 'public', 'images', 'motif-art'),
    outputDir: path.join(ROOT, 'public', 'images', 'previews', 'motif-art')
  }
];

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TARGET_SIZE = 400;

async function listFilesRecursive(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

function toPreviewPath(inputPath, inputDir, outputDir) {
  const relative = path.relative(inputDir, inputPath);
  const parsed = path.parse(relative);
  return path.join(outputDir, parsed.dir, parsed.name + '.webp');
}

async function convertSingleImage(inputPath, outputPath) {
  await ensureDir(path.dirname(outputPath));

  await sharp(inputPath)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: 'cover',
      position: 'centre'
    })
    .webp({ quality: 72, effort: 4 })
    .toFile(outputPath);
}

async function run() {
  let convertedCount = 0;

  for (const group of INPUT_GROUPS) {
    const sourceFiles = await listFilesRecursive(group.inputDir);
    const imageFiles = sourceFiles.filter((filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      return SUPPORTED_EXTENSIONS.has(extension);
    });

    for (const sourceFile of imageFiles) {
      const outputFile = toPreviewPath(sourceFile, group.inputDir, group.outputDir);
      await convertSingleImage(sourceFile, outputFile);
      convertedCount += 1;
      console.log('converted:', path.relative(ROOT, sourceFile), '->', path.relative(ROOT, outputFile));
    }
  }

  console.log('Done. Generated', convertedCount, 'preview image(s) at 400x400 WebP.');
}

run().catch((error) => {
  console.error('Failed to generate preview art:', error);
  process.exitCode = 1;
});
