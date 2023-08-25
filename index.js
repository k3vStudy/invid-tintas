// Import the Chromium browser into our scraper.
import { configDotenv } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { chromium } from 'playwright';
configDotenv();
const { TELEGRAM_BOT_TOKEN, NOT_HEADLESS, TELEGRAM_CHAT_ID } = process.env;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
const browser = await chromium.launch({
	headless: NOT_HEADLESS != 1,
});

let disable_notification = false;
const searchUrl = (searchTerm) =>
	'https://www.invidcomputers.com/busqueda_avanzada.php?buscar=1&palabra=' +
	searchTerm;

async function scrapeTinta(tinta) {
	const page = await browser.newPage();
	await page.goto(searchUrl(tinta));
	const locator = page.locator('.recomendadosrow.row');
	const raw_cmyk = await getCMYK(page);
	await page.screenshot({
		path: `screenshot/${tinta}.png`,
		fullPage: true,
	});
	await page.close();
	return {
		tinta: tinta,
		c: raw_cmyk.c[0],
		m: raw_cmyk.m[0],
		y: raw_cmyk.y[0],
		k: raw_cmyk.k[0],
	};
}

async function scrapeAll() {
	const scrapers = await Promise.all([
		scrapeTinta('664'),
		scrapeTinta('544'),
		scrapeTinta('504'),
	]);
	const message = buildMessage(scrapers);
	console.log(message);
	await browser.close();
	await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
		disable_notification: disable_notification,
		parse_mode: 'MarkdownV2',
	});
}
scrapeAll();

async function getCMYK(page) {
	// const page = await browser.newPage();
	let c, m, y, k;
	try {
		[c, m, y, k] = await Promise.all([
			await page.getByText(/CYAN/).allTextContents(),
			await page.getByText(/MAGENTA/).allTextContents(),
			await page.getByText(/AMARILLO/).allTextContents(),
			await page.getByText(/NEGRO/).allTextContents(),
		]);
	} catch (error) {
		console.log(error);
	}
	return { c, m, y, k };
}
function buildMessage(scrapers) {
	return (
		'*Tintas en stock en Invid*\n' +
		scrapers
			.map((e) => {
				return `${e.tinta}: ${e.c ? 'C' : ' '} ${e.m ? 'M' : ' '} ${
					e.y ? 'Y' : ' '
				} ${e.k ? 'K' : ' '}`;
			})
			.join('\n')
	);
}
