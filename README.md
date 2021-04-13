# mercadopago-activities-scrapper

Simple scrap balance activities on MercadoPago and then exports to a csv.

This scrapper was created for learning purposes and to get relevant data about transactions in mercadopago activities, since the default report don't provide the transaction's description.

## TodoList

- [x] Login To Mercadopago
- [x] Scrap Single page
- [x] Scrap multiple pages
- [x] Sanitize date
- [x] Save to CSV
- [x] Import to mercadopago
- [ ] Fix duplicates
- [ ] Some values are missing in the result
- [x] Convert credentials to .env files [URGENT]


## Known Issues to be solved
- [ ] Values above 1k are shown as 1/100 of the current value
- [ ] Issues with pre 2021 dates, are grouped together - mercado pago does not provide this information
