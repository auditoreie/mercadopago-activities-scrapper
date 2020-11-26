const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const CREDENTIALS = require('./credentials')
const pagesToScrap = 20
const EXPORT_PATH = 'output'

const startBrowser = async () => {
	const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    executablePath:
	  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	userDataDir: './cache'
  });
	const page = await browser.newPage()
	await page.setViewport({width: 1366, height: 768})
	return { browser, page }
}

const closeBrowser = (browser) => {
	return browser.close()
}

const doMercadoPagoLogin = async () => {
	const { browser, page } = await startBrowser()
	await page.goto('https://mercadopago.com.br', {
		waitUntil: 'networkidle2',
		devTools: true
	})
	// If logged, return
	if (page.url().includes('/home')) {
		console.log('Already logged in, returning');
		return { browser, page }
	}
	//click login selector
	await page.waitForSelector(".option-login")
	await page.click(".option-login")
	await page.waitForNavigation()
	//enter login from credentials
	await page.waitForSelector("[name='user_id']")
	await page.focus("[name='user_id']")
	await page.keyboard.type(CREDENTIALS.username)
	await page.keyboard.down('Enter')
	await page.waitForNavigation()
	//click password selector
	//enter password from credentials
	await page.waitForSelector("[name='password']")
	await page.focus("[name='password']")
	await page.keyboard.type(CREDENTIALS.password)
	await page.keyboard.down('Enter')
	//click login button
	await page.waitForNavigation()
	//await for the code
	await page.waitForSelector('#channel-sms')
	await page.click('#channel-sms')
	await  page.waitForNavigation()
	console.log('Must call the dialog right now');
	await page.waitForSelector('input')
	await page.on('dialog', async dialog => {
		await dialog.type('prompt')
		console.log(dialog.message('Enter SMS code'));
		const smsCode = await dialog.accept()
		console.log(smsCode)
		await page.keyboard.type(smsCode)
		await page.keyboard.down('Enter')
		await page.waitForNavigation()
	})

	return { browser, page }
}

/**
 * Parse data to return sanitized data
 * @param {*} time
 */
const parseData = async (time) => {
  const timeToParse = time.toLowerCase()
  const today = new Date()
  const weekdayNumber = today.getDay()
  const weekdays = [
    'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado'
  ]
  // Check for atipical words 'ontem e anteontem'
  if (timeToParse === 'ontem') {
    return `${today.getDate()-1}/${today.getMonth()}/${today.getFullYear()}`
  }

  if (timeToParse === 'anteontem') {
    return `${today.getDate()-2}/${today.getMonth()}/${today.getFullYear()}`
  }

  // If time is in digital clock format
  if (time.indexOf(':') > 0) {
    return today.toLocaleDateString('pt-BR')
  }

  // Get day number from today
  if (weekdays.includes(time.toLowerCase())) {
    // Check if time exposes a past dayweek
    const timeWeekdayNumber = weekdays.indexOf(time.toLowerCase())
    const daysAgo = weekdayNumber > timeWeekdayNumber
      ? weekdayNumber - timeWeekdayNumber
      : 7 + weekdayNumber - timeWeekdayNumber

    const timeMonthDay = today.getDate() - daysAgo
    return `${timeMonthDay}/${today.getMonth()}/${today.getFullYear()}`
  }

  // Get long date e.g 1 de novembro
  const regexLongDate = new RegExp(/\d{1,2}\sde\s\w*/)
  if (regexLongDate.test(time)) {
    const months = [
      undefined, 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ]
    const arrayTime = time.split(' ')
    arrayTime.splice(1,1)
    const [ day, month ] = arrayTime
    const monthNumber = months.indexOf(month.toLowerCase())
    const timeDate = `${day}/${monthNumber}/2020`
    return timeDate
  }
  return time
}

/**
 * Start scraping pages
 * @param {*} page
 */
const scrapPages = async (page) => {
  let currentPage = 1
  let activities = []
  const nextPageButton = '.andes-pagination__button--next'
  const row = '.ui-row__link'
  // Setup inner evaluate functions
  await page.exposeFunction('parseData', parseData)
  while(currentPage < pagesToScrap) {
    let currentPageActivities = await page.evaluate( async () => {
      // main elements container
      const row = '.ui-row__link'
      // elements to be worked on
      const timeTag = '.c-activity-row__time'
      const value = '.price-tag'
      const status = '.c-description-classic__status'
      const currency = '.price-tag-symbol-text'
      const description = '.ui-action-row__title'
      const negativeSymbol = '.price-tag-negative-symbol'
      // Get all rows
      const activities = document.querySelectorAll(row)
      console.log(activities)
      // Result object
      var activitiesData = []
      for (i=0; i < activities.length; i++) {
        let activityData = {}
        activityData.date = await parseData(activities[i].querySelector(timeTag).outerText)
        activityData.description = activities[i].querySelector(description).outerText
        activityData.currency = activities[i].querySelector(currency).outerText
        activityData.type = activities[i].querySelector(negativeSymbol)?.outerText ? "debit" : "credit"
        activityData.value = activities[i].querySelector(value).outerText.split(/\n/gm).slice(1,).join('')
        activityData.status = activities[i].querySelector(status).outerText
        activitiesData.push(activityData)
      }
      return activitiesData
    })
    activities.push(...currentPageActivities)
    console.log('Current page -> ', currentPage)
    console.log('Goto Next Page')
    currentPageActivities = []
    await page.waitForSelector(nextPageButton)
    await page.click(nextPageButton)
    await page.waitForSelector(row)
    currentPage++
  }
	return activities
}

/**
 * Convert to CSV
 */
const convertJsonToCsv = (jsonObject) => {

}

/**
 * Save data to CSV in export path
 */
const saveToCSV = () => {

}

const exportXlsx = () => {

}



( async () => {
	console.log('Project started')
	const { browser, page } = await doMercadoPagoLogin()
	await page.waitForSelector("a>span.nav-icon-activities")
	await page.click("a>span.nav-icon-activities")
	// Check if it is compact
	await page.waitForSelector('a.ui-row__link')
  // 	if (await page.$('.ui-row__col.ui-row__col--heading')) {
  //
  // 		await page.click('.activity-row-toggle__button')
  // 	}
	// Now it must get the data
	const activities = await scrapPages(page)
	console.log({activities})
	// browser.close()
	// process.exit()
})()

