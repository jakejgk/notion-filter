import axios from 'axios';
import 'dotenv/config';

const secret_key = process.env.SECRET_KEY
const test_db = process.env.TEST_DB
const resources_db = process.env.RESOURCES_DB


// get info from database
const query = {
  method: 'POST',
  maxBodyLength: Infinity,
  url: `https://api.notion.com/v1/databases/${resources_db}/query`,
  headers: {
    accept: 'application/json',
    'Notion-Version': '2022-02-22',
    'content-type': 'application/json',
    'Authorization': secret_key
  }
};


// retrieve all database select options
const db = {
  method: 'GET',
  url: `https://api.notion.com/v1/databases/${resources_db}`,
  headers: {
    accept: 'application/json', 
    'Notion-Version': '2022-02-22',
    'Authorization': secret_key
  }
}

const myProps = []
const noSelect = []
const newSelect = []
let mergedObj = {}

axios
  .request(db)
      .then(response => {
        // get all select types available
        const selectTypes = response.data.properties.Type.select.options
        for (let i = 0; i < selectTypes.length; i++) {
          let selectName = selectTypes[i].name.toLowerCase()
          newSelect.push({ [selectName]: selectTypes[i] })
        }
        
        // merge all select types into one object {mergedObj}
        mergedObj = newSelect.reduce((acc, obj) => {
          return { ...acc, ...obj }
        })
      })
      .catch(error => {
        console.log('Getting Types Error \n', error)
      })

axios
  .request(query)
    .then(response => {
      // create array of objects containing name, url, id, and select properties
      for (let i = 0; i < response.data.results.length; i++) {
        let itemName = '';
        let itemUrl = '';
        let itemId = '';
        let currentSelect  = '';

        itemName = response.data.results[i].properties.Name.title[0].plain_text

        if (response.data.results[i].properties.URL.url !== null) {
          itemUrl = response.data.results[i].properties.URL.url
          } else {
          itemUrl = ''
        }

        itemId = response.data.results[i].id

        if (response.data.results[i].properties.Type.select !== null) {
          currentSelect = response.data.results[i].properties.Type.select.name
          } else {
          currentSelect = ''
        }
        // create object for each page in database
        myProps.push({
          "name" : itemName,
          "url": itemUrl,
          "id": itemId,
          "currentSelect": currentSelect
        })
      }
      return myProps
    })
    .then(response => {
      // create array of items with no current select option [noSelect]
      for (let i = 0; i < response.length; i++) {
        if (response[i].currentSelect === '') {
          noSelect.push(response[i])
        }
      }
      return noSelect
    })
    .then(response => {
      // determine type of select option each page needs and turn it into an obj for the patch request
      for (let i = 0; i < noSelect.length; i++) {
        const type = determineType(response[i])

        if (type) {
          response[i].dataObj = {
            "properties": {
              "Type": {
                "select": type
              }
            }
          }
          const addSelect = {
            method: 'PATCH',
            url: `https://api.notion.com/v1/pages/${response[i].id}`,
            headers: {
              accept: 'application/json',
              'Notion-Version': '2022-02-22',
              'Authorization': secret_key,
              'content-type': 'application/json'
            },
            "data": noSelect[i].dataObj
          }
          // patch request to add a select
          axios
            .request(addSelect)
            .then(response => {
              const typeAdded = response.data.properties.Type.select.name
              console.log(`Adding [${typeAdded}] type to \`${noSelect[i].name}\``)
            })
            .catch(error => {
              console.log('Patch Request Error\n', error)
            })
         }
        }
    })
    .catch(error => {
      console.error('Query Database Error\n', error);
    });

// algorithm for determining type of select

// all sites that would be labeled an article
const articleSites = ['substack.com', 'wsj.com', 'bloomberg.com', 'newsletter', 'medium.com', 'blog']
const websites = ['.io', '.ai', '.app']

function determineType(item) {
  if (item.name.includes('reddit') || item.url.includes('reddit.com')) {
    return mergedObj.reddit
  }
  if (item.url.includes('twitter.com')) {
    return mergedObj.tweet
  }
  if (item.url.includes('youtube.com/watch') || item.name.includes('youtube')) {
    return mergedObj.youtube
  }
  if (articleSites.some(site => item.url.includes(site))) {
    return mergedObj.article
  }
  if (item.url.includes('tiktok.com')) {
    return mergedObj.tiktok
  }
  if (item.url.includes('.pdf')) {
    return mergedObj.pdf
  }
  if (item.url.includes('wikipedia.com')) {
    return mergedObj.wikipedia
  }
  if (item.url.includes('github.com')) {
    return mergedObj.coding
  }
  if (websites.some(site => item.url.includes(site))) {
    return mergedObj.website
  }
}