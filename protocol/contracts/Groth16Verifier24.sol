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

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 439828000916518664461568660121565922113216723482123609484128760389459694817;
    uint256 constant deltax2 = 12316089652375902891933898678518896161878145510454175539725832445141319473245;
    uint256 constant deltay1 = 11791980634449764170955889050271982766380609007422564449946870388870289839178;
    uint256 constant deltay2 = 4804572846817067594059304887217688250972662099939318041090493690505786865184;

    
    uint256 constant IC0x = 8547833826321321435057022752083557086045121384786464344208234678570970211609;
    uint256 constant IC0y = 10580836306840855461212167410815974075149217430087220526192489477919429224317;
    
    uint256 constant IC1x = 14724088722682747209234803563229691650646331824777255702192289349526508517727;
    uint256 constant IC1y = 14926964703164035308101467687930581951887580249071965767760211538711804467597;
    
    uint256 constant IC2x = 11520678022576219693430699448864875789164321833133310006571720460283796967166;
    uint256 constant IC2y = 15653889067253935013692778694958935081119044460320699445966198114807715605780;
    
    uint256 constant IC3x = 12721457394555600687182488088674893012590312440721483554431818485044331551565;
    uint256 constant IC3y = 15932029946335471810817346194935456127388616729664513445262188840166164819870;
    
    uint256 constant IC4x = 6367195838107071580073898079966285210281261280265204946715384019740964114494;
    uint256 constant IC4y = 5883876620865502334921571018228719274908351677515923653907378743048826108240;
    
    uint256 constant IC5x = 12230809295511291461880455057557815063652662301418732898893099886496749669656;
    uint256 constant IC5y = 13924961673377630114320767870318960064944366815252480424642397664038593957024;
    
    uint256 constant IC6x = 16441806262180493795377009765405585013604315230155999706366005559888063495075;
    uint256 constant IC6y = 8699187843925780392908168556644120179957619560852514860807619815042300039835;
    
    uint256 constant IC7x = 19160324635515220860984157303974915339511258401215995445142986091481883340443;
    uint256 constant IC7y = 2520554986700071984175790841490882936038308750127676296768096589362076004531;
    
    uint256 constant IC8x = 1422848424185207372532286128106708449947396492580377505908174490007180089044;
    uint256 constant IC8y = 17852027853090103581365917426122459642466134905608578030168316407744753540277;
    
    uint256 constant IC9x = 1314864954803732986094183043430289334529038596387783826912681572660719402558;
    uint256 constant IC9y = 1130404003875239514079960865588753252096106513261491308356775186255472626451;
    
    uint256 constant IC10x = 16080543871631920425056358534870471686207445264418594919892209398767269540136;
    uint256 constant IC10y = 15424728434780580504418193994627634645511444703870531784634615744917506934801;
    
    uint256 constant IC11x = 11029908432514938519640720923268799662684959452370597208051005480505630154832;
    uint256 constant IC11y = 19241979418881017358503548791959251518595998807549839532449542012447088877418;
    
    uint256 constant IC12x = 16038765813858144206999429202575488532865762948522249885672813705374212957925;
    uint256 constant IC12y = 1491865828007530148218726194152863848907456285458550715392933588771852037582;
    
    uint256 constant IC13x = 17594277267047950683348450353155253978756545343405218234708033087098818493360;
    uint256 constant IC13y = 2206514349848684543607972252148249607515870395496652056825100467766208047869;
    
    uint256 constant IC14x = 7283816143499449970760777172486711598729099554613681054599482914994314456840;
    uint256 constant IC14y = 20314269490568304657382651194334747537286453373125914822103335120987191203508;
    
    uint256 constant IC15x = 1603967079786025806098070328973023477074639071900822408489695239848717821004;
    uint256 constant IC15y = 15287269862669761085317458713796062993100352832875987242095598672317279816282;
    
    uint256 constant IC16x = 18995673665890911185582013632997586151791796879683965704831310728446235659719;
    uint256 constant IC16y = 21510082186967094667755334216448892149816645227936809276152151370869755858156;
    
    uint256 constant IC17x = 13699053247031758231559562891322402983262250585478699800651075807291806436924;
    uint256 constant IC17y = 18640689960108791925502195337886238492495978986088918165662730401930100749905;
    
    uint256 constant IC18x = 4936716644361032068288733662898388758425270752482201068928467252176947964465;
    uint256 constant IC18y = 9222707856159463484760860120113349376768686192002586777679381242455372025240;
    
    uint256 constant IC19x = 8064568160126353987264363917128487938885505304155038058135687080704021399061;
    uint256 constant IC19y = 7365337277449378838078330826867955354585626955009319531405750604798488270630;
    
    uint256 constant IC20x = 14802584968962683774706888138900688335433415100487573767598267037258676040796;
    uint256 constant IC20y = 21805389401298728033896659261833101534634370307421127548797174365986562021217;
    
    uint256 constant IC21x = 1398993642415721053642878501960630050200516563939708431529548291323974411583;
    uint256 constant IC21y = 5286129663896147054779881366069710636821546073448561761766889067848251290294;
    
    uint256 constant IC22x = 13166998414907402831930588955699300488112160538297533948775780665522620662823;
    uint256 constant IC22y = 14078987194248530236978774140899589017446680208447128558745791204759672625618;
    
    uint256 constant IC23x = 19954788914736206597503815010081393846999027787847927112907955797022086665821;
    uint256 constant IC23y = 19075384800207238605214381071471947416725423905156029179230434058283421928609;
    
    uint256 constant IC24x = 16533839752495223506030995911420325753010040907973998407074402654777847105686;
    uint256 constant IC24y = 19251483443488557539191580798786879073969654964647027449399078634324353907620;
    
    uint256 constant IC25x = 5477582773021491717174786629761195734657263549533228705090123654028362087577;
    uint256 constant IC25y = 14557621649718858015353931936474963615943305075628047412104760151210103110160;
    
    uint256 constant IC26x = 4162727389497627918173341721177464970390602333849150944723297675469859783608;
    uint256 constant IC26y = 2709439566486572382090710377885493975518594922607444842342380428149053260098;
    
    uint256 constant IC27x = 20111423318805411879001407065969251913180959384125584418305392377181462034997;
    uint256 constant IC27y = 21259133466644345918979410824640867256305486074661963968925130444645608403751;
    
    uint256 constant IC28x = 6245307879032780097544551707212338171798911550987089062190367808968658313445;
    uint256 constant IC28y = 2514394257003235254354024145895840572439981769954279316561220004884477506450;
    
    uint256 constant IC29x = 19670951172624227579016729113339217718657802736974804387198089225683505129614;
    uint256 constant IC29y = 21562510430835540376979714588410648983429697287834728423458302958914538125912;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[29] calldata _pubSignals) public view returns (bool) {
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
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
