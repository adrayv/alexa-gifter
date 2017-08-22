import json
import pprint

file = open("utterances.txt","w")
jsonObj = None
slots = None
getGif = "getGifIntent "
getPhone = "getPhoneIntent "
yes = "customYesIntent "
stop = "AMAZON.StopIntent "
gif = "gif "
endl = "\n"
#pp = pprint.PrettyPrinter(indent=1)
with open('intents.json') as json_data:
    jsonObj = json.load(json_data)
    slots = jsonObj["intents"][2]["slots"]
    #pp.pprint(jsonObj["intents"][1]["slot"][0]["name"])

file.write(getPhone + "{PHONE} " + endl)
file.write(getPhone + "My phone number is " + "{PHONE} " + endl)
file.write(getPhone + "My number is " + "{PHONE} " + endl)
file.write(getPhone + "It's " + "{PHONE} " + endl)

file.write(yes + "yes" + endl)
file.write(yes + "yes" + endl)
file.write(yes + "yeah" + endl)
file.write(yes + "yup" + endl)
file.write(yes + "sure" + endl)
file.write(yes + "yes please" + endl)
file.write(yes + "correct" + endl)

for i in range(0, len(slots)):
    file.write(getGif + "send me something about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "send me a gif about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "send me the {" + slots[i]["name"] + "} gif" + endl)
    file.write(getGif + "find me something about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "find me a gif about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "find me the {" + slots[i]["name"] + "} gif" + endl)
    file.write(getGif + "give me something about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "give me a gif about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "give me the {" + slots[i]["name"] + "} gif" + endl)
    file.write(getGif + "get me something about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "get me a gif about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "get me the {" + slots[i]["name"] + "} gif" + endl)
    file.write(getGif + "I want something about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "I want a gif about {" + slots[i]["name"] + "}" + endl)
    file.write(getGif + "I want the {" + slots[i]["name"] + "} gif" + endl)
    #file.write(getGif + "{" + slots[i]["name"] + "}" + endl)

#print(jsonObj.intents[1].slot[0].name)
#print(jsonObj.intents[1].slot[0].type)

