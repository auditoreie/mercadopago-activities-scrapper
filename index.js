const puppeteer = require('puppeteer')

const CREDENTIALS = require('./credentials')
const pagesToScrap = 20

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

// single element classes (for future reference)
// const date = 'c-description-compact__time'
// const description = 'c-description-compact__title'
// const price = 'c-activity-row__price--compact'

// Click on Paginate
const goToNextPage = () => {
  console.log('must go to next page')
  page.click('.andes-pagination__button--next')
}

const getCurrentPageActivities = async (page) => {
  let currentPage = 1
  let activities = []
  const nextPageButton = '.andes-pagination__button--next'
  const row = '.ui-row__link'
  while(currentPage < pagesToScrap) {
    let currentPageActivities = await page.evaluate(() => {
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
        activityData.time = activities[i].querySelector(timeTag).outerText
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


// Export section
const exportCSV = () => {

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
	const activities = await getCurrentPageActivities(page)
	console.log({activities})
	// browser.close()
	// process.exit()
})()
