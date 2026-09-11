import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'http://localhost:8443';

const SCREENS = [
  {
    name: '01-login',
    description: 'Login Screen',
  },
  {
    name: '02-error-not-registered',
    description: 'Error - User Not Registered',
    setup: async (page) => {
      await page.waitForTimeout(500);
      const buttons = await page.$$('button');
      if (buttons.length > 2) {
        await buttons[2].click(); // Click "Not Registered" demo button
        await page.waitForTimeout(800);
      }
    },
  },
  {
    name: '03-no-project',
    description: 'No Project Assigned',
    newPage: true,
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(500);
      const buttons = await page.$$('button');
      if (buttons.length > 1) {
        await buttons[1].click(); // Click "No Project" demo button
        await page.waitForTimeout(800);
      }
    },
  },
  {
    name: '04-dashboard',
    description: 'Dashboard - Project List',
    newPage: true,
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(500);
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        await buttons[0].click(); // Click "Dashboard" demo button
        await page.waitForTimeout(800);
      }
    },
  },
  {
    name: '05-project-detail',
    description: 'Project Detail - Overview',
    setup: async (page) => {
      const openButtons = await page.$$('button');
      const lastButton = openButtons[openButtons.length - 1];
      if (lastButton) {
        await lastButton.click(); // Click "Open" button for first project
        await page.waitForTimeout(800);
      }
    },
  },
  {
    name: '06-members',
    description: 'Project Members - Table',
    setup: async (page) => {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Members')) {
          await btn.click();
          await page.waitForTimeout(800);
          break;
        }
      }
    },
  },
  {
    name: '07-add-member-modal',
    description: 'Add Member Modal',
    setup: async (page) => {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Add Member')) {
          await btn.click();
          await page.waitForTimeout(800);
          break;
        }
      }
    },
  },
];

async function captureScreenshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log('🎬 Starting screenshot capture...\n');

    let page;
    for (let i = 0; i < SCREENS.length; i++) {
      const screen = SCREENS[i];
      try {
        console.log(`📸 ${screen.name}: ${screen.description}`);

        // Create new page if needed or specified
        if (!page || screen.newPage) {
          if (page) await page.close();
          page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 960 });
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        }

        // Execute screen setup
        if (screen.setup) {
          try {
            await screen.setup(page);
          } catch (setupError) {
            console.log(`   ⚠️  Setup warning: ${setupError.message}`);
          }
        }

        // Take screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${screen.name}.png`);
        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
        });

        console.log(`   ✅ Saved: ${screen.name}.png\n`);
      } catch (screenError) {
        console.log(`   ❌ Failed: ${screenError.message}\n`);
      }
    }

    if (page) await page.close();

    console.log(`\n✅ All screenshots captured!`);
    console.log(`📁 Location: ${SCREENSHOTS_DIR}`);
    console.log(`📋 Files ready to import into Figma\n`);

    // List files
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    console.log('📸 Screenshots captured:');
    files.forEach(f => console.log(`   - ${f}`));

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
