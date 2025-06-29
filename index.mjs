import "dotenv/config";
import puppeteer from "puppeteer";
import fs from "fs";
import { sample } from "lodash-es";

let MESSAGES = fs.readFileSync("messages.txt").toString().split("\n");
try {
    MESSAGES = MESSAGES.filter(x => x !== fs.readFileSync("last_message.txt").toString());
} catch {}

let message = sample(MESSAGES).trim();
if (!/\p{Extended_Pictographic}/u.test(message)) {
    let random = Math.random();
    if (random < 0.1) {
        message += " 🐜🐜";
    } else if (random < 0.3) {
        message += " 🐜";
    }
}

const delay = (time) => {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

const browser = await puppeteer.launch({ headless: false, userDataDir: "./profile" });
const page = await browser.newPage();

// FIRST RUN - UNCOMMENT AND SIGN IN
// await page.goto("https://venmo.com/account/sign-in")
// await delay(120000)

async function loadPage(url, maxRetries = 10) {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await page.goto(url);
        const status = response.status();
        if (status !== 200) {
          console.log(`Received ${status} status code. Retrying...`);
          retries++;
          await delay(500);
        } else {
          return response; // Successful load
        }
      } catch (error) {
        console.error('Error loading page:', error);
        retries++;
      }
    }
    
    throw new Error('Max retries reached. Unable to load page.');
  }

// Select user to pay
await loadPage("https://account.venmo.com/pay");

if (page.url().includes("id.venmo.com")) {
    await page.waitForSelector("input[type='password']");
    await page.type("input[type='password']", process.env.VENMO_PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForNavigation();
}

await page.waitForSelector(".MuiInputBase-inputAdornedStart")
await page.type(".MuiInputBase-inputAdornedStart", "@Nicholas-Gebo-2");
await (await page.waitForSelector("img[alt='Nicholas-Gebo-2']")).click()

// Set up payment details
await page.type("#payment-note", message)
await page.type("input[aria-label='Amount']", "0.01")
await page.evaluate(() => {
    document.querySelectorAll("button").forEach((button) => {
        if (button.textContent === "Pay") {
            button.click()
        }
    });
});

// Wait for payment methods to populate
await page.waitForSelector(".MuiSwitch-root");

// Pay
await page.evaluate(() => {
    document.querySelectorAll("button").forEach((button) => {
        console.log(button.textContent)
        if (button.textContent === "Pay Nicholas Gebo $0.01") {
            button.click()
        }
    });
});


// Cleanup
await Promise.race([page.waitForNavigation(), delay(30000)]);
await page.close();

fs.writeFileSync("last_message.txt", message, { flag: "w" });
process.exit(0);
