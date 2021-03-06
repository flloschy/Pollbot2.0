const {
    Message,
    MessageEmbed,
    MessageActionRow,
    MessageSelectMenu,
} = require("discord.js");
const fs = require("fs");
module.exports = {
    async create(
        interaction,
        title,
        description,
        id,
        options,
        min,
        max,
        end,
        autoend,
        results
    ) {
        // load poll data
        let polljson = JSON.parse(
            fs.readFileSync("./data/commands/poll/polls.json", "utf8")
        );

        // create embed
        let embed = new MessageEmbed()
            .setColor("709163")
            .setTitle(`**${title}**`)
            .setDescription(
                "```\n" +
                    description +
                    "```\n" +
                    "[i] When poll ends, votes " +
                    (results ? "will" : "won't") + // change string matching to settings
                    " be published!\n" +
                    "[i] Poll will " +
                    (autoend ? "automatically" : "manually") + // change string matching to settings
                    " end <t:" + // ---
                    end + // create end timestamp
                    ":R>.\n" + // ---
                    "[i] Poll started at <t:" + // ---
                    Math.floor(Date.now() / 1000) + // create start timestamp
                    ":f>." // ---
            )
            .setFooter({ text: `id: ${id}`, iconURL: null });

        var select_options = [
            {
                // hardcoded first option to be able to remove users votes
                label: "#0",
                description: "I abstain / I want to remove my vote",
                value: "-1",
            },
        ];

        // for each option, add it to embed
        options.forEach(async (value, i, a) => {
            embed.addField(
                `**#${i + 1}**: *__${value}__*`,
                "Votes: **0** [░░░░░░░░░░]"
            );

            // prepare option for select menu
            select_options.push({
                label: `#${i + 1}`,
                description: `${value}`,
                value: i.toString(),
            });
        });

        // create select menu
        let row = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId("poll")
                .setPlaceholder(`Vote between ${min} and ${max} options!`)
                .setMinValues(min)
                .setMaxValues(max)
                .addOptions(select_options)
        );

        // send poll
        await interaction.reply({ embeds: [embed], components: [row] });
        let msg = await interaction.fetchReply();

        // prepare data for json
        let data = {
            title: title.toString(),
            description: description.toString(),
            options: options,
            voters: 0,
            votes: {},
            min: min,
            max: max,
            end: end,
            autoend: autoend,
            results: results,
            author: interaction.user.id,
            message: msg.id,
            channel: msg.channel.id,
        };

        polljson[interaction.guild.id][id] = data;

        // push to json
        await fs.writeFileSync(
            "./data/commands/poll/polls.json",
            JSON.stringify(polljson, null, 2)
        );
    },

    async vote(interaction, votes) {
        let polljson = JSON.parse(
            fs.readFileSync("./data/commands/poll/polls.json", "utf8")
        );

        let msg = interaction.message;
        let id = msg.embeds[0].footer.text.replace("id: ", "");

        if (!polljson.hasOwnProperty(interaction.guild.id))
            polljson[interaction.guild.id] = {};
        if (!polljson[interaction.guild.id].hasOwnProperty(id)) {
            await interaction.reply({
                content: "A poll with this ID does not exist.",
                ephemeral: true,
            });
            return;
        }

        polljson[interaction.guild.id][id]["voters"] = 0;

        if (votes.includes(-1)) {
            delete polljson[interaction.guild.id][id]["votes"][
                interaction.user.id
            ];
            await interaction.reply({
                content: "Your votes have been removed.",
                ephemeral: true,
            });
        } else {
            polljson[interaction.guild.id][id]["votes"][interaction.user.id] =
                votes;
        }

        for (var [user, uvotes] of Object.entries(
            polljson[interaction.guild.id][id]["votes"]
        )) {
            polljson[interaction.guild.id][id]["voters"] += uvotes.length;
        }

        msg.embeds[0].fields.forEach(async (value, i, a) => {
            let votes = 0;
            for (var [user, uvotes] of Object.entries(
                polljson[interaction.guild.id][id]["votes"]
            ))
                if (uvotes.includes(i.toString())) votes++;

            let full = Math.floor(
                (votes / polljson[interaction.guild.id][id]["voters"]) * 10
            );
            let empty = 10 - full;

            msg.embeds[0].fields[i].value =
                "Votes: **" +
                votes +
                "** [" +
                "█".repeat(full) +
                "░".repeat(empty) +
                "]";
        });

        console.log();

        await msg.edit({
            embeds: [msg.embeds[0]],
            components: [msg.components[0]],
        });
        await interaction.reply({
            content: "Your vote(s) have been entered.",
            ephemeral: true,
        });
        await fs.writeFileSync(
            "./data/commands/poll/polls.json",
            JSON.stringify(polljson, null, 0)
        );
    },

    async getvotes(guildid, id, client) {
        let polljson = JSON.parse(
            fs.readFileSync("./data/commands/poll/polls.json", "utf8")
        );

        let votelist = {
            1: [],
            2: [],
            3: [],
            4: [],
            5: [],
            6: [],
            7: [],
            8: [],
            9: [],
            10: [],
        };
        for (let [userid, uvotes] of Object.entries(
            polljson[guildid][id]["votes"]
        )) {
            for (let vote of uvotes) {
                vote = parseInt(vote) + 1;
                if (vote !== 0) {
                    let user = client.users.cache.get(userid.toString());
                    if (!user) votelist[vote].push("<@" + userid + ">");
                    else votelist[vote].push(user.username);
                }
            }
        }

        let content = "";
        for (let [i, value] of Object.entries(votelist)) {
            if (value.length > 0) content += `**#${i}**: ${value.join(", ")}\n`;
        }
        if (content.length == 0) content = "No votes recorded.";
        return content;
    },

    async endpoll(guildid, id, client, resultsoverwrite) {
        let polljson = JSON.parse(
            fs.readFileSync("./data/commands/poll/polls.json", "utf8")
        );

        if (resultsoverwrite !== undefined)
            polljson[guildid][id]["results"] = resultsoverwrite;

        try {
            var channel = await client.channels.cache.get(
                polljson[guildid][id]["channel"]
            );
            var msg = await channel.messages.fetch(
                polljson[guildid][id]["message"]
            );
        } catch (e) {
            console.log(e);
            delete polljson[guildid][id];
            await fs.writeFileSync(
                "./data/commands/poll/polls.json",
                JSON.stringify(polljson, null, 2)
            );
            return;
        }

        let maxvotes = 0;
        let duplicates = [];
        msg.embeds[0].fields.forEach(async (value, i, a) => {
            let votes = parseInt(
                value["value"]
                    .replace("Votes: ", "")
                    .replace("**", "")
                    .replace("**", "")
            );
            if (votes > maxvotes) {
                duplicates = [];
                maxvotes = votes;
                duplicates.push(i);
            } else if (votes == maxvotes) {
                duplicates.push(i);
            }
        });

        duplicates.forEach(async (value, i, a) => {
            msg.embeds[0].fields[value]["value"] =
                msg.embeds[0].fields[value]["value"] + " **(Winner)**";
        });

        msg.embeds[0].description = msg.embeds[0].description.replace(
            `[i] Poll will automatically end <t:${polljson[guildid][id]["end"]}:R>.`,
            `[i] Poll has ended <t:${Math.floor(Date.now() / 1000)}:R>.`
        );

        msg.embeds[0].description = msg.embeds[0].description.replace(
            `[i] Poll will manually end <t:${polljson[guildid][id]["end"]}:R>.`,
            `[i] Poll has ended <t:${Math.floor(Date.now() / 1000)}:R>.`
        );

        msg.components[0].components[0].setDisabled(true);

        await msg.edit({
            embeds: [msg.embeds[0]],
            components: [msg.components[0]],
        });

        if (polljson[guildid][id]["results"]) {
            let votes = await this.getvotes(guildid, id, client);
            await msg.reply(votes);
        }

        delete polljson[guildid][id];
        await fs.writeFileSync(
            "./data/commands/poll/polls.json",
            JSON.stringify(polljson, null, 2)
        );
    },
};
