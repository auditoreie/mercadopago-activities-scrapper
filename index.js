const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const pagesToScrap = 29
const EXPORT_PATH = 'output'

const startBrowser = async () => {
	const browser = await puppeteer.launch({
		headless: true,
		devtools: true,
	userDataDir: './cache'
	});
	const page = await browser.newPage()
	await page.setViewport({width: 1440, height: 768})
	return { browser, page }
}

const closeBrowser = (browser) => {
	return browser.close()
}

// Page elements
const loginPageButton = '.nav-header-guest__link--login'
const usernameInput = '[name=\'user_id\']'
const passwordInput = '[name=\'password\']'
const smsButton = '#channel-sms'



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
	await page.waitForSelector(loginPageButton)
	await page.click(loginPageButton)
	await page.waitForNavigation()
	//enter login from credentials
	await page.waitForSelector(usernameInput)
	await page.focus(usernameInput)
	await page.keyboard.type(process.env.MERCADO_USERNAME)
	await page.keyboard.down('Enter')
	await page.waitForNavigation()
	//click password selector
	//enter password from credentials
	await page.waitForSelector(passwordInput)
	await page.focus(passwordInput)
	await page.keyboard.type(process.env.MERCADO_PASSWORD)
	await page.keyboard.down('Enter')
	//click login button
	await page.waitForNavigation()
	//await for the code
	await page.waitForSelector(smsButton)
	await page.click(smsButton)
	await page.waitForNavigation()
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
		return `${today.getDate()-1}/${today.getMonth()+1}/${today.getFullYear()}`
	}

	if (timeToParse === 'anteontem') {
		return `${today.getDate()-2}/${today.getMonth()+1}/${today.getFullYear()}`
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
		return `${timeMonthDay}/${today.getMonth()+1}/${today.getFullYear()}`
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
		const timeDate = `${day}/${monthNumber}/2021`
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
		await page.waitForSelector(row)
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
			for (let i=0; i < activities.length; i++) {
				const activityData = {}
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
		currentPage++
		await page.waitForSelector(nextPageButton)
		await page.click(nextPageButton)
	}
	return activities
}

const convertJsonToCsv = (jsonObj) => {
  const finalCsv = []
  let skippedCount = 0
  jsonObj.forEach(item => {
    const  { date, value, description } = item
    if(date.split('/')[0] < 0) {
      skippedCount ++
      return
    }
    const currentItem = [date, value, description].join(';')
    finalCsv.push(currentItem)
  })
  console.log('Skipped ', skippedCount)

  return finalCsv
}

const convertArrayToString = (arrayData) => arrayData.join('\n')

const saveCsvToFile = (fileContentArray) => {
  try {
    fileContentArray.forEach((fileContent, index) => {
      const stringContent = convertArrayToString(fileContent)
      return fs.writeFileSync(`./output/final-${index}.csv`, stringContent)
    })
  } catch(e) {
    throw e
  }
}

const getTimeStamp = () => {
  const now = new Date();
  const [ day, month, year, hours, minutes ] = [
    now.getDay(), now.getMonth(), now.getFullYear(),
    now.getHours(), now.getMinutes()
  ]
  return `${year}.${month}.${day}.${hours}${minutes}`
}

const readJsonFile = (fileFullPath) => {
  return data = require(fileFullPath)
}

const saveJsonToFile = async (jsonObj) => {
  try {
    const savePath = path.join(__dirname, EXPORT_PATH)
    const timestamp = getTimeStamp()
    const fileName = `mercadopago_export${timestamp}.json`
    const fullSavePath = `${savePath}/${fileName}`
    fs.writeFileSync(fullSavePath, JSON.stringify(jsonObj))
    return fullSavePath
  } catch(e) {
    throw(e)
  }
}

const splitDataInChunks = async (arrayData) => {
  try {
    console.log(arrayData)
    const chunkSize = 499
    const header = ['"Data";"Valor";"Descrição"']
    const chunks = []
    while(arrayData.length > 0) {
      const chunk = [
        header,
        ...arrayData.splice(0, chunkSize)
      ]
      chunks.push(chunk)
    }
    return chunks
  } catch (e) {
    console.log(e)
  }
}

const getApiDirectData = async () => {
	const axios = require('axios')
	const url = 'https://www.mercadopago.com.br/banking/balance/api/activities?limit=10&offset=500'
	const response = await axios.get(url, { withCredentials: true })
    console.log(response)
	const json = await response.json()
	console.log(json)
	return response
}


( async () => {
	console.log('Project started')
	const { browser, page } = await doMercadoPagoLogin()
	const apiData = await getApiDirectData()

	await page.goto('https://www.mercadopago.com.br/banking/balance/activities')

	// await page.waitForNavigation()
	// const activities = await scrapPages(page)
  // console.log(activities.length)
	// browser.close()

  console.log('Initializing second step')
  // await saveJsonToFile(activities)
  // const arrayData = convertJsonToCsv(activities)
  // const arrayChunks = await splitDataInChunks(arrayData)
  // console.log(arrayChunks.length)
  // saveCsvToFile(arrayChunks)
  
	// process.exit()
})()


