// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const { ActivityHandler, MessageFactory } = require('botbuilder');
const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")
class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');
        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions)
       
        // create a DentistScheduler connector
        this.scheduler = new DentistScheduler(configuration.SchedulerConfiguration)
      
        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            const qnaResults = await this.QnAMaker.getAnswers(context);
            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);

            // If an answer was received from QnA Maker, send the answer back to the user.
            if (qnaResults[0]) {
                await context.sendActivity(`${qnaResults[0].answer}`);
            }

            else if (LuisResult.luisResult.prediction.topIntent === "getAvailability" &&
                LuisResult.intents.getAvailability.score > .6 &&
                LuisResult.entities.$instance
            ) {
                if (LuisResult.entities.$instance.date &&
                    LuisResult.entities.$instance.date[0]){
                        const date = LuisResult.entities.$instance.date[0].text;
                        // call api with location entity info
                        let getAvaiTimeRange = await this.scheduler.getAvailability();
                        await context.sendActivity(getAvaiTimeRange);
                    }
                else if (LuisResult.entities.$instance.dayPeriod &&
                    LuisResult.entities.$instance.dayPeriod[0]){
                        const dayPeriod = LuisResult.entities.$instance.dayPeriod[0].text;
                        // call api with location entity info
                        const getAvaiTimeRange = "I am free in " + dayPeriod + ", you can come whenever you like";
                        await context.sendActivity(getAvaiTimeRange);
                    }
                else{
                    let getAvaiTimeRange = await this.scheduler.getAvailability();
                    await context.sendActivity(getAvaiTimeRange);
                }
                await next();
                return;
            }

            else if (LuisResult.luisResult.prediction.topIntent === "scheduleAppointment" &&
                LuisResult.intents.scheduleAppointment.score > .6 &&
                LuisResult.entities.$instance
            ) {
                if (LuisResult.entities.$instance.date &&
                    LuisResult.entities.$instance.date[0] &&
                    LuisResult.entities.$instance.time &&
                    LuisResult.entities.$instance.time[0]){
                        const date = LuisResult.entities.$instance.date[0].text;
                        const time = LuisResult.entities.$instance.time[0].text;
                        // call api with location entity info
                        let scheduledTime = await this.scheduler.scheduleAppointment(date+time);
                        // const scheduledTime = "Appointment on " + date + ", at " + time + " is confirmed.";
                        // console.log(getAvaiTimeRange)
                        await context.sendActivity(scheduledTime);
                    }
                else{
                    const reply = "Please provide a more specfific appointment (date & time) you want to make";
                    await context.sendActivity(reply);
                }
                await next();
                return;
            }
            else {
                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity(`I'm not sure I can answer your question`
                    + 'I can find available time range that patients can visit. '
                    + `Or you can ask me questions about treatments`);
            }
             
            await next();
    });
        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Hola, welcome to Contoso Dentist Chatbot';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}
module.exports.DentaBot = DentaBot;
