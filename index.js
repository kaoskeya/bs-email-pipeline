const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio')
const axios = require('axios');
const formurlencoded = require('form-urlencoded').default;
const minify = require('html-minifier').minify;
const htmlToText = require('html-to-text');
const _ = require('lodash');

const ENDPOINT = "https://bootstrap-email.herokuapp.com/";

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
  const tempCookie = initialPage.headers['set-cookie'][0];
  const cookie = tempCookie.substring(tempCookie.indexOf("=") + 1, tempCookie.indexOf(";"));
  
  const $ = cheerio.load(initialPage.data);

  const body = {
    "utf": "✓",
    "authenticity_token": $('[name=authenticity_token]').val(),
    markup,
    "checkbox1": "on",
  }

  let renderedPage;
  try {
    renderedPage = await axios.request({
      url: ENDPOINT,
      method: "post",
      headers: {
        "Cookie": `_bootstrap_email_rails_example_session=${cookie};`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      data: formurlencoded(body),
    })
  } catch (e) {
    console.log(e)
    return;
  }

  const $2 = cheerio.load(renderedPage.data);
  const outputHtml = minify($2('#responseCodeMirror').val(), {
    collapseWhitespace: true,
    removeComments: true,
    quoteCharacter: "'",
  }).replace(/\s{2,}/g, ' ')
  .replace('"', "'");
  const $3 = cheerio.load(outputHtml);
  const outputSubject = $3('.preview').text();

  fs.writeFileSync(renderedFile, outputHtml, 'utf8');

  fs.writeFileSync(outputJsonFile, JSON.stringify({
    "Template": {
      "TemplateName": `${filename}${env ? `-${env}` : ''}`,
      "SubjectPart": outputSubject.replace(/ +(?= )/g,''),
      "TextPart": htmlToText.fromString(outputHtml),
      "HtmlPart": outputHtml,
    }
  }), 'utf8');
}

convertBsEmail();