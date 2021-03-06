var roleHarvester = require("role.harvester");
var roleBuilder = require("role.builder");
var roleWarrior = require("role.warrior");
var roleUpgrader = require("role.upgrader");
var roleRepairman = require("role.upgrader");
var roleClaimnant = require("role.claimnant");
var roleRoadbuilder = require("role.roadbuilder");
var roleExtractor = require("role.extractor");
var roleCarrier = require('role.carrier');
var rolesUtil = require("util.roles")

module.exports = {
    run: function(room, isReservation, parent) {
        
        var desiredHarvesters = roleHarvester.getDesired(room);
        var desiredBuilders = isReservation ? 0 : 1;
        var desiredUpgraders = isReservation ? 0 : 1;
        var desiredCarriers = isReservation ? 1 : 2;
        var desiredWarriors = isReservation ? 1 : 0;
        var desiredRepairmen = isReservation ? 0 : 0;
        var desiredClaimnants = isReservation ? 2 : 0;//Note: The are CLAIM body parts, not claimnants
        var desiredRoadbuilders = isReservation ? 1 : 0;
        var desiredExtractors = 0;
        
        if(room.energyCapacityAvailable == room.energyAvailable && Math.floor(0.5 + Math.random()*99 == 0)){
            //desiredBuilders++;
        }
        
        if(room.storage && room.storage.store.energy > 10000){
            desiredBuilders++;
        }
        if(room.storage && room.storage.store.energy > 30000){
            desiredBuilders++;
        }
        if(room.storage && room.storage.store.energy > 60000){
            desiredBuilders++;
        }
        if(room.storage && room.storage.store.energy > 80000){
            desiredBuilders++;
        }
        if(room.controller.level <= 3){
            desiredBuilders++;
            desiredBuilders++;
        }



        //Scale our consumption and distribution with the amount of energy on the floor
        if(!isReservation && room.controller.level <= 3){
            desiredBuilders = desiredBuilders + room.getDroppedResourcesTotal() / 750;
        } else {
            desiredCarriers = desiredCarriers + room.getDroppedResourcesTotal() / 750;
        }
        
        if(!isReservation && room.find(FIND_STRUCTURES, {
            filter:function(struct) {
                return struct.structureType == STRUCTURE_ROAD || struct.structureType == STRUCTURE_RAMPART
            }
        }).length > 0){
            desiredRepairmen++;
        }


        
        var spawnRoom = isReservation ? parent : room;

        var spawn = this.getSpawnFromRoom(spawnRoom);
        if(!spawn){
            return;
        }
        
        //console.log(desiredHarvesters+":"+isReservation);
        var builders = 0;
        var harvesters = 0;
        var upgraders = 0;
        var carriers = 0;
        var warriors = 0;
        var claimnants = 0;
        var repairmen = 0;
        var roadbuilders = 0;
        var extractors = 0;
        
        //Handle reservation claimnants
        if(isReservation){
            //desiredClaimnants = parent.energyCapacityAvailable >= 1350 ? 1 : 2;
            
            //Now count the CLAIM modules we have in use
            for(var name in Game.creeps){
                if(Game.creeps[name].memory.home == room.name){
                    var body = Game.creeps[name].body;
                    for(var i  in body){
                        if(body[i].type == CLAIM){
                            
                            claimnants = claimnants + 1;
                        }
                    }
                }
            }
        }
        
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];
            
            if(creep.memory.home == room.name){
                if (creep.memory.role == 'harvester') {
                    harvesters++;
                } else if (creep.memory.role == 'upgrader') {
                    upgraders++;
                } else if (creep.memory.role == 'builder') {
                    builders++;
                }else if (creep.memory.role == 'carrier') {
                    carriers++;
                }else if (creep.memory.role == 'warrior') {
                    warriors++;
                }else if (creep.memory.role == 'repairman') {
                    repairmen++;
                }else if (creep.memory.role == 'roadbuilder') {
                    roadbuilders++;
                }else if (creep.memory.role == 'extractor') {
                    extractors++;
                }
            }
        }
        room.memory.harvesters = harvesters;
        
        //Would it be desirable to have an extractor?
        if(extractors == 0){
            if(this.isExtractorRequired(room)){
                desiredExtractors++;
            }
        }
        
        var budget = spawn.room.find(FIND_MY_CREEPS).length == 0 || harvesters == 0 ? Math.max(300, spawn.room.energyAvailable) : spawn.room.energyCapacityAvailable;
        
        //Spawn more creeps if needed
        if (desiredHarvesters > harvesters){
            spawn.createCreep(roleHarvester.getDesign(budget, room), undefined,       {role: 'harvester', home: room.name});
        } else if (desiredCarriers > carriers){
            spawn.createCreep(roleCarrier.getDesign(budget, room), undefined,         {role: 'carrier', home: room.name});
        } else if (desiredBuilders > builders){
            spawn.createCreep(roleBuilder.getDesign(budget, room), undefined,         {role: 'builder', home: room.name});
        } else if (desiredUpgraders > upgraders){
            spawn.createCreep(roleUpgrader.getDesign(budget, room), undefined,        {role: 'upgrader', home: room.name});
        } else if (desiredClaimnants > claimnants){
            spawn.createCreep(roleClaimnant.getDesign(budget, room), undefined,       {role: 'claimnant', home: room.name});
        } else if (desiredWarriors > warriors){
            spawn.createCreep(roleWarrior.getDesign(budget, room), undefined,         {role: 'warrior', home: room.name});
        } else if (desiredRepairmen > repairmen){
            spawn.createCreep(roleRepairman.getDesign(budget, room), undefined,       {role: 'repairman', home: room.name});
        }else if (desiredRoadbuilders > roadbuilders){
            spawn.createCreep(roleRoadbuilder.getDesign(budget, room), undefined,     {role: 'roadbuilder', home: room.name});
        }else if (desiredExtractors > extractors){
            spawn.createCreep(roleExtractor.getDesign(budget, room), undefined,       {role: 'extractor', home: room.name});
        }
    },

    isExtractorRequired: function(room){
        if(CONTROLLER_STRUCTURES[STRUCTURE_EXTRACTOR][room.controller.level] === 0){
            return false;
        }

        var mineral = room.find(FIND_MINERALS)[0];

        if(room.storage == null
            || room.storage[mineral.mineralType] > STORAGE_CAPACITY * 0.5
            || _.sum(room.storage.store) > STORAGE_CAPACITY * 0.8){
            return false;
        }

        return true;
    }, 

    spawnRole: function(spawn, roleName, mem, budget){
        if(!mem){
            mem = {};
        }
        if(!mem.home){
            mem.home = spawn.room.name;
        }
        mem.role = roleName;
        var role = rolesUtil[roleName];
        return spawn.createCreep(role.getDesign(budget), undefined, mem);
    },

    //Returns a vacant one (if any)
    getSpawnFromRoom: function(room){
        if(!room){
            return;
        }
        var spawns = room.find(FIND_MY_SPAWNS, {
            filter: function(spawn){
                return !spawn.spawning;
            }
        });
        return spawns[0];
    }
};