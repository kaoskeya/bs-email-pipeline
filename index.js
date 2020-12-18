const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio')
const axios = require('axios');
const formurlencoded = require('form-urlencoded').default;
const minify = require('html-minifier').minify;
// const htmlToText = require('html-to-text');
const queryString = require('query-string');
const _ = require('lodash');

const ENDPOINT = "https://editor.bootstrapemail.com/documents";

// function decodeData(value) {
//   return queryString.stringify(
//     queryString.parse(
//       value
//     ),
//     { encode: false }
//   )
// }

async function convertBsEmail() {
  // set up filename, base dir, extract markup.
  const file = process.argv[2];
  const env = process.argv[3];
  const filename = path.basename(file).split(".")[0];

  const markup = fs.readFileSync(file, 'utf8');

  const renderedFile = path.resolve(path.dirname(file), `../rendered/${filename}.html`);
  const outputJsonFile = path.resolve(path.dirname(file), `../json/${env ? `${env}/` : ''}${filename}.json`);

  // fetch page and set up cookies and token
  const initialPage = await axios.get(ENDPOINT);

  const tempCookie = initialPage.headers['set-cookie'][1];
  const cookie = tempCookie.substring(tempCookie.indexOf("=") + 1, tempCookie.indexOf(";"));
  
  const $ = cheerio.load(initialPage.data);

  const body = {
    "authenticity_token": $('[name=authenticity_token]').val(),
    markup,
    email_address: "",
  }

  let renderedPage;
  try {
    renderedPage = await axios.request({
      url: ENDPOINT,
      method: "post",
      headers: {
        "Cookie": `_bootstrap_email_editor_session=${cookie};`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      data: formurlencoded(body),
    })
  } catch (e) {
    console.log(e.response)
    return;
  }

  const $2 = cheerio.load(renderedPage.data, {
    xmlMode: true
  });
  // console.log($2('#hiddenCompiled').html());
  
  const outputHtml = minify($2('#hiddenCompiled').html(), {
    collapseWhitespace: true,
    removeComments: true,
    quoteCharacter: "'",
  }).replace(/\s{2,}/g, ' ')
  .replace('"', "'");
  const $3 = cheerio.load(outputHtml);
  const outputSubject = $3('#subject').text();

  fs.writeFileSync(renderedFile, outputHtml, 'utf8');

  fs.writeFileSync(outputJsonFile, JSON.stringify({
    "Template": {
      "TemplateName": `${env ? `${env}-` : ''}${filename}`,
      "SubjectPart": outputSubject.replace(/ +(?= )/g,''),
      "TextPart": "Please view the HTML version", // htmlToText.fromString(outputHtml),
      "HtmlPart": unescape(outputHtml),
    }
  }), 'utf8');
}

convertBsEmail();
