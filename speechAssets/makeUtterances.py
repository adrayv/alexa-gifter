import json
import pprint

file = open("utterances.txt","w")
jsonObj = None
slots = None
base = "getGifIntent "
gif = "gif "
endl = "\n"
#pp = pprint.PrettyPrinter(indent=1)
with open('intents.json') as json_data:
    jsonObj = json.load(json_data)
    slots = jsonObj["intents"][1]["slots"]
    #pp.pprint(jsonObj["intents"][1]["slot"][0]["name"])

for i in range(0, len(slots)):
    file.write(base + "send me a {" + slots[i]["name"] + "} gif" + endl)

#print(jsonObj.intents[1].slot[0].name)
#print(jsonObj.intents[1].slot[0].type)

