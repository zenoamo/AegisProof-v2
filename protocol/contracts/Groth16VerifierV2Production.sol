// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/
// ============================================================================
// PRODUCTION VERIFIER — AegisProof v2 (30 public signals).
// Generated from the Phase 4 multi-contributor + beacon trusted setup.
// production.zkey SHA-256: ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571
// production-vkey SHA-256: d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec
// Ceremony records: artifacts/phase4/ (transcripts, hashes, beacon record).
// Pair ONLY with an AegisShieldV2 deployment intended for production use.
// ============================================================================


pragma solidity >=0.7.0 <0.9.0;

contract Groth16VerifierV2Production {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 5842649005223799615298527368529143880984793419564869191773188705736148654207;
    uint256 constant alphay  = 3774426109239006427924633015998782271511869170296943255763422559315551344880;
    uint256 constant betax1  = 12484582446791032612961504445837458970173130843497263348389714934926479908681;
    uint256 constant betax2  = 12308571065922772347699969987738138048788401264466397842998878296309128698742;
    uint256 constant betay1  = 9318740351413099512144921875041509889656727663742187949093456090463488125359;
    uint256 constant betay2  = 16681862208075097024797935383678532160037728426857583831333477205681835326505;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 15444325654253893884656700931439401338072697368427123643309197970862264953623;
    uint256 constant deltax2 = 551469974212069502069165446564078239718835443915417784901449354256516125502;
    uint256 constant deltay1 = 15555950959624487275423724562768044434562774319407278541759062017234570273630;
    uint256 constant deltay2 = 169594786279675152802388120782984095057957150372327268433819798364642577603;

    
    uint256 constant IC0x = 10956237616436207194892056724746552827550490067271647513370790678947665765821;
    uint256 constant IC0y = 12606071778804988517747186548779317056064223377809073693349003055492776505382;
    
    uint256 constant IC1x = 7034990929211915209481764559183058431720320245425566861272001536559989341400;
    uint256 constant IC1y = 17139747935417182392304997654763603969332679764013081032945732999333740267644;
    
    uint256 constant IC2x = 4904564121620377875193461910851972176048391506499876163440531754958893735099;
    uint256 constant IC2y = 10932129687792127076254216728761418237776852171032669844377213543281368819335;
    
    uint256 constant IC3x = 19221492149693704118060325733982610371888581874245637654355537142577878990051;
    uint256 constant IC3y = 3367935678683857296347290994805091469845269754440045628727258288290315598854;
    
    uint256 constant IC4x = 238027140512251189226896347196188470397447695653130077708394155135068117108;
    uint256 constant IC4y = 8112247205085011997403159381016005119663876619675717515478770964716028156143;
    
    uint256 constant IC5x = 10087633671119579627111112491802057345140558897519977557449940341007604736089;
    uint256 constant IC5y = 11539581654030065182015775209266287002360862089138578857062922228355267473904;
    
    uint256 constant IC6x = 17561927857874126348627032016213619221411810011652358133742928936018532917306;
    uint256 constant IC6y = 10225571695208147889693408492858453565476366810398065613777187318298867273991;
    
    uint256 constant IC7x = 19579874694028760537605315178729389285351878283362127334769377844235188319496;
    uint256 constant IC7y = 4308729556966272376448681805489467896325988075855831560630085023684044483336;
    
    uint256 constant IC8x = 595645878764855686674663719635674867922693901592561717090748322756644027218;
    uint256 constant IC8y = 15644185030442627876972729129370011546223540131389598633593949694004852774190;
    
    uint256 constant IC9x = 1919504330702666884531107345493753582483632396295336775535389816354966546593;
    uint256 constant IC9y = 2019919271598934986301343141497189786212857620087975465281973449173347885785;
    
    uint256 constant IC10x = 21049139578966097907619619536289751622454616956363020038565639070133658571868;
    uint256 constant IC10y = 11556947988425121898656144420680090985005831572843920454194082396210971525379;
    
    uint256 constant IC11x = 21774350338779879520688398992184049655109274336570430668547869384467219624918;
    uint256 constant IC11y = 10477933328554454778018373290682250764036025371309005297697678287802438118466;
    
    uint256 constant IC12x = 4441207068173564935571054042237430111498705489501502479615110175123852142426;
    uint256 constant IC12y = 21592953683490838229874126029652615023856711240751145394552576710399440727875;
    
    uint256 constant IC13x = 7003578283144400859620187209741613950510166537385817455976704710867836801910;
    uint256 constant IC13y = 13289165127785598657626361477192479319738311885390660698570415277699053110237;
    
    uint256 constant IC14x = 21365232780828383689123625401942146881881228191252247444086398357646911800015;
    uint256 constant IC14y = 12078972584456131346628218363926723122807694651182285663266543198170697606224;
    
    uint256 constant IC15x = 1052931775781048609460640552434447903758964701422675865419922893121675644844;
    uint256 constant IC15y = 282922573473116013836930389666969637565835587087194614401385862285139745695;
    
    uint256 constant IC16x = 14444154901980167819820809486224589309520652319162056534955392498187265668594;
    uint256 constant IC16y = 3071212498807529852101999350188200548023089222285755141221596133263418932094;
    
    uint256 constant IC17x = 2019170594088212115415132425650674423096540142021625381764620270553824282465;
    uint256 constant IC17y = 6733744477805892791891478242634839352924207930937763454008343591920939654411;
    
    uint256 constant IC18x = 16661142545022585023926944270526186045334716015021798893572664621682895901299;
    uint256 constant IC18y = 14366756722384826830119595880389780830690418217457681906402034725451002689666;
    
    uint256 constant IC19x = 1366707490976793476988065196037705280968737444153041075168566398082837876322;
    uint256 constant IC19y = 19999728083341197210009122722410403927388516951277412328134199385925705319747;
    
    uint256 constant IC20x = 16699178324454072350839578086317214985936725035988788739719912411278784272387;
    uint256 constant IC20y = 17660068106763368621392269399314842068934517763777590903575042709542377563084;
    
    uint256 constant IC21x = 3311617276807797305659545139939954599389861084573408163454146838589649196640;
    uint256 constant IC21y = 19161102615872403964987822683793186967130341057098983983088034698672339881514;
    
    uint256 constant IC22x = 1139626466194516645926708009694684653388713390012511758306608361395758006793;
    uint256 constant IC22y = 9798302110936153813244684932722168411097244335001545750963796672917393740028;
    
    uint256 constant IC23x = 9080417340863301522914503767984015616203442288855419348303674573179131310305;
    uint256 constant IC23y = 9073232972486848212364672226774428432284922496245397787998456203571255657883;
    
    uint256 constant IC24x = 3704094630955928869531479341966887721792351898395358501945102326480296348900;
    uint256 constant IC24y = 16809065596089739878661844706398552296997876346076788230204446200010008072871;
    
    uint256 constant IC25x = 16756700865298438923102648163643389689276540754644216360340168776374388330808;
    uint256 constant IC25y = 14386344990823753136407098829714554255031204076031341858976145244863881161238;
    
    uint256 constant IC26x = 21426767542837047530136853337335555488153243894218979140623414310346814885947;
    uint256 constant IC26y = 15243686526217865777496869146527281943792367379887568802006985923001258741496;
    
    uint256 constant IC27x = 21697788408517196652025923390771456206698425153657854447329857367449795780267;
    uint256 constant IC27y = 6043888158654356800032562678138887694141688129684334881294491462832505452351;
    
    uint256 constant IC28x = 3472598256497375010798529497181755733959061727803364488147324901963203018409;
    uint256 constant IC28y = 6190693434781894000615175749839420845570206382197003446821113376882160397180;
    
    uint256 constant IC29x = 17725570291979533631656620100146096055988009334162182052728810496830857464660;
    uint256 constant IC29y = 3409429660777843901790818411917874703102298506845262359931822493910532105665;
    
    uint256 constant IC30x = 19861888984012685243182385854340750693364597375815267615179344802777566065962;
    uint256 constant IC30y = 11359904662138166913380450719171034838076984765214058471849413138322538583668;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[30] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                
                g1_mulAccC(_pVk, IC28x, IC28y, calldataload(add(pubSignals, 864)))
                
                g1_mulAccC(_pVk, IC29x, IC29y, calldataload(add(pubSignals, 896)))
                
                g1_mulAccC(_pVk, IC30x, IC30y, calldataload(add(pubSignals, 928)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            
            checkField(calldataload(add(_pubSignals, 864)))
            
            checkField(calldataload(add(_pubSignals, 896)))
            
            checkField(calldataload(add(_pubSignals, 928)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
