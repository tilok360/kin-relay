// Word lists for Word Duel and Hangman, bundled with the app (common English words; nothing is fetched).
// answers: secret words for Word Duel. allowed: extra five-letter words Word Duel accepts as guesses. hang: Hangman words.
(function (root) {
  const W = {
    answers: `about their there which would other after first think could these where right being going still never those world
    great while every state three since under thing house place again found might money night until doing group start
    today point music power water based small white later order party thank black whole maybe story least early local
    video young court given level often south known large wrong along class close cause happy human woman leave north
    watch light short taken third among check heart child major media phone quite final front ready bring march study
    clear month board field force issue price space total above share sense break event sorry guess learn added alone
    movie press tried worth sound value round stand stuff drive green match model trust range trade chief lower style
    china stage title enjoy cover legal seven staff super union built crazy daily paper voice whose earth below offer
    sleep table truth build piece visit wrote river shall speak write album eight funny peace spent store track ahead
    allow brown radio cross speed extra quick agree clean photo scene spend coach heavy train claim hotel judge brain
    floor image meant reach civil dance stock trump worst beach ended older color dream grand sweet touch doubt drink
    shown basic carry fully japan plant smith worse award block lived peter avoid catch coast trial truly queen broke
    glass prior royal serve begin twice worry brand count fresh mouth owner scale score smart throw click faith metal
    agent apply enter prime waste weird adult grade stone apart aware fifth birth labor lucky prove tough alive apple
    dress horse magic stick frank guide raise treat youth henry exist guard solid sport taste harry hello plane shape
    upper cheap joint steel tired crowd enemy fixed limit ocean proof chair honor noted stuck sugar drama entry grant
    grown lying route saved smoke squad teach angry laugh lunch storm actor chain equal quiet split urban fault mixed
    phase smile truck blame false fired novel shirt cream giant mayor minor theme usual draft spoke upset cycle armed
    aside empty prize rural admit favor frame guest teeth bunch fruit index shift stood tight crown grace chose crash
    depth dirty error noise panel plate shame cable print sight broad drawn motor solar blind brief chest debut paint
    pilot steam exact quote swear trend bread inner reply tower wheel faced pride rough smell topic sharp trick audio
    chart mount occur argue awful bound cloud loose moral shock thick threw angel flash gross refer trail uncle badly
    chase ideal jimmy kelly clock label pitch pizza plain anger comic ghost newly skill solve trash boost dutch hired
    knife saint buddy delay elite forth layer marry nurse sheet bench idiot medal roger shell silly angle clark forum
    grass hence rapid sixth valid vital creek fraud honey ratio scary spell sword begun daddy drove glory juice logic
    strip dozen fancy input knock ought flood maria rally swing alert arena billy brave fleet robin shake shore blast
    pound punch grave mouse piano craft devil rated sauce slide tiger alien beast candy fifty relax alarm globe hoped
    larry spare opera quest sized anime barry jerry lover panic scope alpha brick mercy outer screw venue habit laura
    naval noble robot terry toxic wound asset baker brush essay maker snake ultra usage bobby canal climb fever fluid
    nasty perry twist unity blown fence stole swiss dealt flesh forty laser loyal patch radar villa adopt blade cargo
    cried humor nerve sandy sheep trace chill didnt grain liver rival sadly slept spray suite verse bless chuck couch
    crush genre lease shine tweet blake inter react rocky shade tommy vocal yield bacon burst costa salad stake swift
    welsh awake blank curve harsh hurry mason nancy organ pearl sweat alike arrow cabin eagle eaten guilt haven theft
    valve charm cruel delta ridge tribe canon stamp voter witch array belly booth cliff derby fatal lemon ralph shark
    colin dairy diary drill meter olive setup skull smash basin breed bride chick fairy freak grief lined lodge merit
    micro rebel tooth viral widow beard curse drain flame ninth penny petty reign scare sunny cheat cheer chile demon
    elder fiber fried pulse realm shout alter brass graph shook stack aging audit dried singh spite burnt buyer cease
    cloth eager elect lobby orbit ranch trunk badge carol ferry gauge rider shelf width legit loser sheer stark thumb
    wheat wrist acute blair civic clerk crude drone flour pause puppy slice vinyl probe remix sneak spark steep straw
    weigh adapt dense kitty whale amber ankle armor berry clash grasp handy manga poker sally scout steak sweep tumor
    cheek curry drake polar skirt spike toast waist wreck blend brake cough depot drank feast frost purse tense chess
    float grind grove hobby lance lynch risky sided sober spice swept towel arise bloom clown dodge guild prone siege
    sixty sonic spine admin baked betty crane donor honda marco randy tenth batch paste plaza stare blunt champ ditch
    riley scrap shaft slope snack stern stiff sworn unite vault wagon homer jenny midst mommy onion rogue abbey baron
    bunny choir holly karma shiny spoon thief alley bully burke marsh messy molly roast salon tuned vague brett coral
    covid dough hardy irony maple relay risen stunt yahoo freed ivory kerry niche porch utter walsh creep donna elbow
    exile goose grill ruler spill swamp tasty decay flown imply merry reset shave vodka drift hatch niece scent slate
    surge token woody yacht manor pupil spoil allan altar fatty flush hairy ounce pablo seize spicy sting wired belle
    raven stall strap bliss daisy faint forge notch omega queue trout bravo crawl digit flint jelly lunar peach silva
    cedar heath pinch rover syrup dwarf liner merge moron naive pedro rigid vivid boxer brook hedge joker laden rainy
    salty serum skate stray tempo torch turbo arose blink chang chili excel faded glove greed greet owing proxy renew
    rumor stoke thigh troll aisle amino bleed brace choke motto onset prose razor steer ample bingo brock cubic irene
    macro shady slack slick stove tract vista vogue adore creed crisp crust`,
    allowed: `times death needs comes works fight blood focus crime basis turns yours funds shoot sides links abuse dying goods
    thats lewis pants bonus naked virus steal blues boots chaos corps stays gains wages chips bases mines sizes teens
    tales jeans clips minus ashes skies whats cyrus atlas traps bowls genus props flora gamma grape juicy moody prank
    spear stain tidal wrath blaze brent chalk flock hyper moist monte rabbi scoop scrub shale trait troop wasnt clone
    drown jewel obese piper scarf timer tying wakes borne dusty focal noisy snail tutor verge yeast erase manly oxide
    pence repay ropes rouge shove snaps basil booze chord crest fetch fuzzy nexus optic panda slash stein baton camel
    chunk cocoa comet dread dummy flank flare lever pedal query sewer smack sonny swell align attic await cache comfy
    flick funky groom hogan hydro lyric plead clive debit lotus malik paddy tally timed wedge alloy crank linen moose
    motel resin rusty stint weary willy agony benny binge caste chant colon curly fetus mound muddy sammy weber abide
    avail hanna madam nanny piles poppy tease bluff flyer miner needy patty swipe tango blitz cigar circa cloak dover
    dwell fiery goofy jolly mummy peggy purge rhino venom windy blush furry mango oasis oddly paced pagan psalm rhyme
    savvy spree vapor witty woven amend bloke bowel cater deity edged finch gypsy sedan slang algae ariel bowie dolly
    ethic flair haunt hazel jenna slain specs stash viola waved yummy adobe brawl chevy clint logos quota swore weave
    arent denim erect flirt flute matte morse stool taxed tibet tread truce unfit aloud boast brink cobra porto sigma
    usher annex barge birch bland bribe canoe cider equip havoc humid manny milky mixer nicky pivot ryder suing arbor
    cisco cling icing lapse login mimic mural nasal patel quasi reese cameo deter diner envoy fungi gravy psych rinse
    scalp squat thorn toned wharf wiser crate crave gloss graft guise leash mater rodeo shire swung taboo alias annoy
    grail kappa liter penal plank privy siren smear snowy stalk stink swine clamp inlet kudos mains mould quake racer
    recap shaky stout stump wally berth mania parry patio prism renal roach sloan sniff squid swarm taxis abbot aspen
    bleak bogus dizzy enact hound mourn pouch shack stale tummy wager whack blanc broom brute buffy eater froze hitch
    julio medic nylon ozone rotor wigan abbas agile carve crook darts diver filth genie glued hubby ledge levin natal
    piled torah torso abyss arson basal demos elves ether fetal finer fused gorge latex motif paolo papal peril shear
    snoop tenor zebra broth cocky cones evade maxim misty pinky quits satin slows tonic twain vowed ditto gland jumbo
    kraft slime spawn waltz butch cheng ching crore dixie haste otter relic reuse vicar apron exert glare hefty slump
    azure cadet craze geese phony tammy coupe ebony folly itchy junta latch libel lofty maize picky prima regal shalt
    sheen sleek sling adept bowed doggy eerie ethel farce fling flung fudge gemma glide norma plaid plush smoky spade
    vowel buggy cutie dodgy ethos hinge mamma manic melon rowan shred synod garth gloom heaps limbo lousy overt pious
    reins rufus thine viper beige bosch bulky emery incur leafy piggy shrug sonar stony taper toxin cello feral hasty
    husky laced perch truss undue wacky assay fishy frail glaze rhine sinus stung whine abort banjo beech comma dogma
    evoke lowly lucid petit polio saver snuck timor tweak angst bison expel fitch frown godly groin helix hover knack
    kodak missy potty silky stair brood dandy leach quilt sauna scrum slade snare stomp suede timid tweed uncut widen
    braid bulge forte kayak kneel recon vigil waive aroma budge clout corny gated girly hoard horde lotto nitro poked
    proto shone sissy taker triad valor wight bathe giddy melee merch nudge payer serge tempt whiff chico flake hasan
    ionic lorry mover rowdy sassy takin tramp wield brisk bundy defer flask fluff giver gnome lupus lymph palsy polka
    repel rohan skier swoop waged whoop amaze chute derry drier epoch fated foggy gator magma nutty plume plump shrub
    stead bagel bigot bumpy codex conte facet firth floss josie locus moors playa posse saber samba slant soles spelt
    tacky tulip croft darby erika felon grate hilly huron leech madly nifty salle seine shawl valet baggy carte fable
    gabby infer lager laird strut swirl theta zoned awoke axial carat chore crept curvy filly footy grunt halal masse
    mucus pixie sever snuff stoic actin avert avian bayou chime delve fluke growl hater nosed pasha soggy stoop ville
    youve abode dazed dowry harem hippo inept juror liang modal pluck puffy quail quirk rabid scorn vouch wafer amuse
    aptly brunt bucky chaps groan hives hoist massa murky pinto tarot fives folio franc gully lilac padre quill revel
    rower spire spout sully whisk alibi clasp crypt edict fiend hurst jerky mower oiled pesky rouse scant sheik skunk
    sloth spoof tonga trope bafta butte foyer grime heron inert lumen piety remit savoy tonal totem acorn alamo aloft
    amman beset gable howdy marge munch reddy slimy snout spank spied tunic brine churn faust hunch morph nomad revue
    rigor roper shank thyme toner unify aegis ascot brill caged diode ester hertz leaky quack semis bosom leapt prius
    quark teeny anvil cabal cadre cramp decoy drool fixer foray friar fussy goody hutch jetty khaki koala merle petal
    poise rupee smirk smyth snipe stave swami trove winch amour arjun banco crock dunne erode kebab rondo scion ulcer
    vigor axiom chino graze longs mince moray speck adorn cabot cumin decal fecal lingo lohan meaty parma quart ruddy
    sahib scala snort apnea banda bower capes duchy femur gusto hippy jazzy kiosk quell roost shard sieve spore swain
    tania tenet tiled aback aloof cajun druid duvet eject forgo freer fryer largo larva livid molar rayon sable slush
    smelt booby bushy clung criss ginny groot hough mocha noose parse savor taint tiara vinny visor acton alder bossy
    crumb diddy ember erupt evict gleam gummy idiom jaded pooch scour talon thump truer yearn caddy chasm crass maris
    piped prune snape taunt whirl adage boyer brash dhoni edema flack liege`,
    hang: `provide sound source usually value evidence follow official production reading round stand stuff whatever amount drive
    federal feeling green league management match model picture trust central forward range review science trade attention
    brother cannot character chief football lower natural property quality style amazing august china complete economic
    involved itself language related stage title article attack decided decision enjoy entire release situation technology
    turned written choice considered continue council cover currently election financial foreign increase legal seven
    simple simply staff super union built career crazy daily daughter difficult figure hospital modern paper popular
    starting version voice whose writing earth forget listen practice success waiting access below missing offer sleep
    table truth build district minister percent piece recent seeing straight visit wrote culture growth included married
    officer respect response river shall speak specific standard tonight write album century charge create effect eight
    except funny limited moving network peace provided recently spent store student tomorrow track watching weight
    addition ahead allow brown capital committee conference difference double expect island normal population potential
    pressure radio station treatment western beginning campaign certainly completely content credit cross despite female
    husband individual leading message nearly particular quickly region section speed travel consider contact positive
    throughout welcome absolutely additional beyond extra leaving minute nature quick unless winning agree canada clean
    computer episode favorite income justice manager movement photo posted safety scene spend statement ability calling
    coach collection continued definitely designed heavy knowledge search subject train author claim generally german
    global hotel interested judge leader letter material nobody product regular secretary sister annual battle brain
    contract degree finished floor growing image insurance majority meant opening opinion physical reach seriously stupid
    successful active approach biggest cancer civil dance defense direction master russia stock trump weekend wonder worst
    awesome beach clearly commercial effort ended fighting imagine impact latest learning multiple older operation protect
    secret senior spring telling address anyway bought choose color commission direct dream easily finish grand literally
    marriage necessary speaking supposed sweet touch yesterday caught closed congress damage directly disease doctor doubt
    drink driving greater machine notice overall professor shown associated basic captain carry effective explain fully
    highly holding japan plant reality smith winter worse advice agreement award block broken challenge comment equipment
    eventually lived nation otherwise peter primary purpose showing teacher theory agency avoid camera catch coast economy
    executive meaning mission produced therefore trial truly weather activity coffee complex condition division evening
    flight freedom highest interview library location queen sitting standing walking accept actual appear attempt broke
    channel distance eating exchange finding glass learned losing mobile northern powerful prior protection receive royal
    screen serve speech traffic wearing wonderful agreed airport begin bottom demand engine everybody investment keeping
    partner raised solution southern square stopped structure twice worry brand count covered critical digital forced
    fourth fresh mental mostly mouth owner previously realize remain scale score separate smart surface throw totally
    twitter wedding acting benefit budget click estate faith fashion feature generation hearing metal profile returned
    target village agent animal apply authority becoming enter foundation memory prime selling silver spread supply waste
    weird adult apparently artist chairman edition grade happening healthy institute method obviously option senate
    smaller somebody stone strength window winner correct extremely handle improve indeed negative prevent removed spirit
    television trouble advantage apart aware decide dinner eastern fifth function helping herself impossible influence
    marketing produce progress require background birth bridge carried concept garden housing journal labor leadership
    length lucky neither patient possibly prove setting software tough alive apple balance birthday connection dress
    easier fellow horse knowing magic request stick vehicle volume beauty billion concerned corner cultural develop driver
    frank guide operating paying raise slightly suggest surprise technical treat unique variety youth appreciate bigger
    breaking discovered excited forever henry injury lovely magazine martin ordered parliament prepared reference religion
    somewhere stated strategy audience closer democratic excellent exist guard honest medicine mention mountain nuclear
    presence reaction reduce solid sport stress taste victory afternoon assistant classic electric emergency entirely
    failure festival harry hello initial massive picked plane plenty prince proper providing quarter regional session
    shape teaching toward transfer upper useful valley watched willing accident advanced anywhere capacity cheap climate
    discussion drinking fantastic flying governor hundred industrial joint museum promise purchase remove spending steel
    supporting terrible tired turning afraid border command crowd dating enemy`,
  };
  for (const k in W) W[k] = W[k].split(/\s+/);
  if (typeof module === "object" && module.exports) { module.exports = W; return; }
  root.KG_WORDS = W;
})(typeof self !== "undefined" ? self : this);
