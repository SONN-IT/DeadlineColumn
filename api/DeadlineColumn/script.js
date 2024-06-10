var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { ThreadPaneColumns } = ChromeUtils.importESModule("chrome://messenger/content/thread-pane-columns.mjs");

const ids = [];

var customColumns = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    context.callOnClose(this);
    
    return {
      customColumns: {
        async add(id, name, field) {
          ids.push(id);

          const DATE_REGEX = /(3[01]|[12][0-9]|0?[1-9])\.(1[012]|0?[1-9])\.((?:19|20)\d{2})|(3[01]|[12][0-9]|0?[1-9]).?\s?([a-zA-Zä]+).?((?:19|20)\d{2})|(keine Frist)/gi;
          const MONTH_MAPPING = {
            'Jänner': '01', 'Januar': '01', 'January': '01', 'Februar': '02', 'February': '02', 'März': '03', 'March': '03',
            'April': '04', 'Mai': '05', 'May': '05', 'Juni': '06', 'June': '06', 'Juli': '07', 'July': '07', 'August': '08',
            'September': '09', 'Oktober': '10', 'October': '10', 'November': '11', 'Dezember': '12', 'December': '12'
          };
          
          function decodeSubject(message) {
            var mimeConvert = Components.classes["@mozilla.org/messenger/mimeconverter;1"]
              .getService(Components.interfaces.nsIMimeConverter);
            return mimeConvert.decodeMimeHeader(message.subject || "", null, false, true);
          }

          function getDeadline(message) {
            let subject = decodeSubject(message);
          
            let matches = decodeSubject(message).matchAll(DATE_REGEX);
            let hasNoDeadlinePhrase = false;
            let extractedDates = [];
          
            for (const match of matches) {
              let dateString = "";
          
              // This switch extracts the date from the regex matches.
              switch (true) {
                case !!(match[1] && match[2] && match[3]):
                  // Date format: "DD.MM.YYYY"
                  dateString = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
                  break;
          
                case !!(match[4] && match[5] && match[6]):
                  // Date format: "DD. MonthName YYYY" or "DD MonthName YYYY"
                  let month = MONTH_MAPPING[match[5]];
                  if (month) {
                    dateString = `${match[6]}-${month}-${match[4].padStart(2, "0")}`;
                  }
                  break;
          
                case !!match[7]:
                  // Phrase: "keine Frist"
                  hasNoDeadlinePhrase = true;
                  break;
          
                default:
                  break;
              }
          
              if (dateString) {
                let timestamp = new Date(dateString).valueOf() / 1000;
                if (Number.isInteger(timestamp)) {
                  extractedDates.push(timestamp);
                }
              }
            }

            // This returns the date in the correct format, if no date is present, it will use a very high date.
            // If "keine Frist" is present a slightly lower one, so the sort is correct
            switch (extractedDates.length) {
              case 0:
                if(hasNoDeadlinePhrase) {
                  return {
                    text: "keine Frist",
                    unixTime: new Date("5200-01-01T00:00:00Z").getTime() / 1000
                  }
                } else {
                  return {
                    text: "",
                    unixTime: new Date("5100-01-01T00:00:00.000Z").getTime() / 1000
                  }
                }
              case 1:
                return { 
                  text: new Date(extractedDates * 1000).toLocaleDateString("de-AT", { year: 'numeric', month: '2-digit', day: '2-digit' }),
                  unixTime: extractedDates[0]
                };
              default:
                return {
                  text: "",
                  unixTime: extractedDates[0]
                }
            }
          }

          ThreadPaneColumns.addCustomColumn(id, {
            name: name,
            hidden: false,
            icon: false,
            resizable: true,
            sortable: "bySortKey",
            sortCallback: (message) => getDeadline(message).unixTime, // to reserve this sorting use -getDeadline
            textCallback: (message) => getDeadline(message).text
          });
        },

        async remove(id) {
          ThreadPaneColumns.removeCustomColumn(id);
          ids.remove(id);
        }
      },
    };
  }

  close() {
    for (const id of ids) {
      ThreadPaneColumns.removeCustomColumn(id);
    }
  }
};
