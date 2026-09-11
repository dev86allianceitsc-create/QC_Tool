const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
    action: async (page) => {
      await page.click('button:nth-of-type(3)'); // Click "Not Registered" demo button
    },
  },
  {
    name: '03-no-project',
    description: 'No Project Assigned',
    action: async (page) => {
      await page.evaluate(() => window.location.reload());
      await page.goto(BASE_URL);
      await page.click('button:nth-of-type(2)'); // Click "No Project" demo button
    },
  },
  {
    name: '04-dashboard',
    description: 'Dashboard - Project List',
    action: async (page) => {
      await page.evaluate(() => window.location.reload());
      await page.goto(BASE_URL);
      await page.click('button:nth-of-type(1)'); // Click "Dashboard" demo button
    },
  },
  {
    name: '05-project-detail',
    description: 'Project Detail - Overview',
    action: async (page) => {
      // From dashboard, click first project
      await page.click('button:contains("Open")');
    },
  },
  {
    name: '06-members',
    description: 'Project Members - Table',
    action: async (page) => {
      // Click Members tab
      await page.click('button:contains("Members")');
    },
  },
  {
    name: '07-add-member-modal',
    description: 'Add Member Modal',
    action: async (page) => {
      // Click "+ Add Member" button
      await page.click('button:contains("Add Member")');
    },
  },
  {
    name: '08-edit-member-modal',
    description: 'Edit Invited User Modal',
    action: async (page) => {
      // Click Edit button on INVITED member
      await page.click('button:contains("Edit")');
    },
  },
  {
    name: '09-cancel-confirmation',
    description: 'Cancel Invitation Confirmation',
    action: async (page) => {
      // Click Cancel button
      await page.click('button:contains("Cancel"):nth-of-type(2)');
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

    for (const screen of SCREENS) {
      try {
        console.log(`📸 ${screen.name}: ${screen.description}`);

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 960 });

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // Go to base URL
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content to load
        await page.waitForTimeout(500);

        // Execute screen-specific actions
        if (screen.action) {
          try {
            await screen.action(page);
            await page.waitForTimeout(500);
          } catch (actionError) {
            console.log(`   ⚠️  Action failed, capturing current state: ${actionError.message}`);
          }
        }

        // Take screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${screen.name}.png`);
        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
        });

        console.log(`   ✅ Saved: ${screen.name}.png\n`);
        await page.close();
      } catch (screenError) {
        console.log(`   ❌ Failed: ${screenError.message}\n`);
      }
    }

    console.log(`\n✅ Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log(`📁 Ready to import into Figma!\n`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
