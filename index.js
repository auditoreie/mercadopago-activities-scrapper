const puppeteer = require('puppeteer')

const CREDENTIALS = require('./credentials')
const pageLength = 1 

const startBrowser = () => {
	const browser = await puppeteer.launch({headless:false})
	const page = await browser.newPage()
	await page.setViewPort({width: 1366, heigth: 768})
	return { browser, page }
}

const closeBrowser = (browser) => {
	return browser.close()
}

const doMercadoPagoLogin = async () => {
	const { browser, page } = await startBrowser()
	await page.goto('https://mercadopago.com.br', {
		waitUntil: 'networkidle2'
	})
	//click login selector
	await page.waitForSelector("[name='username']")
	//enter login from credentials
	await page.type("[name='username']", CREDENTIALS.username)
	//click password selector
	await page.keyboard.down('Tab')
	//enter password from credentials
	await page.keyboard.type(CREDENTIALS.password)
	//click login button
	page.waitForNavigation()
	//await for the code
	//prompt user for sms code
	//enter sms code
	//click next button
	page.click('button')
	page.waitForNavigation()
	//click on activities page
	//return activities page logged in
	return page
}

// single element classes (for future reference)
// const date = 'c-description-compact__time'
// const description = 'c-description-compact__title'
// const price = 'c-activity-row__price--compact'

const getCurrentPageActivities = () => {
	// main elements container
	const row = 'ui-row__link'
	// elements to be worked on
	const activities = document.getElementsByClassName(row)
	// Result object
	var activitiesData = []
	// Loop and sanitize data for each page
	for (i=0; i < activities.length; i++) {
		const activityRawData = activities[i].innerText.split('\n')
		let activityData = {}
		activityData.time = activityRawData[0]
		activityData.description = activityRawData[1]
		activityData.price = activityRawData.splice(4,).join('')
		activitiesData.push(activityData)
	}

	return activitiesData
}

// Click on Paginate
const goToNextPage = () => {

}

// Export to 
const exportCSV = () => {

}



( async () => {
	await gotoMercadoPago()
	process.exit()
})
