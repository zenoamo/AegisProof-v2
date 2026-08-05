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
    uint256 constant deltax1 = 8063983237638992991531218884320536886790412818872586641720726629296136876674;
    uint256 constant deltax2 = 3362833667325301948383920118024085828091402334828583641587956113283887192332;
    uint256 constant deltay1 = 14500053106648044979316353310703788762792119448111415712597763606737982433307;
    uint256 constant deltay2 = 11881972518782422980050121021061120833170914498663847893068561330833815382977;

    
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
    
    uint256 constant IC6x = 17238826918159874278429454329020148693797257980250963943563550897781543883703;
    uint256 constant IC6y = 18456294361909319786810930680665828068644386885595371644272742445218962571192;
    
    uint256 constant IC7x = 4717395748056273217361941144854008694210052365831903642017918290263541785568;
    uint256 constant IC7y = 17967667424861976113508795856592955260945362428013541760797059617112784159421;
    
    uint256 constant IC8x = 16492915643277122663609763381523729146783569722469523725613552034873743811838;
    uint256 constant IC8y = 881946906842747443086060341623299219672690465937897590432310032647459806856;
    
    uint256 constant IC9x = 15688534302221988789329237976522120813229481228279265422997551999620750559140;
    uint256 constant IC9y = 19427341381884798451156311641954230929630815067427143875096194325028017148065;
    
    uint256 constant IC10x = 3124828345386576428472443274503049632404385631806584051862275976593258952000;
    uint256 constant IC10y = 4066008534006456767823351473860238873089898184824207841471305756913603801538;
    
    uint256 constant IC11x = 9050204379667626090857600211294710868596804444840019850172947636524492271328;
    uint256 constant IC11y = 3857769633767001772753075408513540149066409673476937293231117764592378303547;
    
    uint256 constant IC12x = 3852089529804472505617507122355499457718582251474583198587603993581197670460;
    uint256 constant IC12y = 12500840628354333539458550927998794785959283451880702794226865692440325814491;
    
    uint256 constant IC13x = 4084586641268181431594410153106309749824544105085229726307844966455905897428;
    uint256 constant IC13y = 15370817510363918060799004941480299315548032114993422800179820218730200794595;
    
    uint256 constant IC14x = 12669054869443406951050543287565642447789723557062740801385125536749954116218;
    uint256 constant IC14y = 10480587039808583060477233229928542074843795672546993713884080763942301931988;
    
    uint256 constant IC15x = 877570338342019662494860622701830114682878123670227782987683180752127242345;
    uint256 constant IC15y = 1638679987320091831411487644563909415448172610801609591191420625673777058658;
    
    uint256 constant IC16x = 12989545185830718549579127346789200335257477770140445151404991157568397597010;
    uint256 constant IC16y = 17562442910349421516697270150124765917598644684085145104675450237337382689895;
    
    uint256 constant IC17x = 12044366077135333457998380800719269291558200438019539413422323432176795518431;
    uint256 constant IC17y = 16267998514220632314735529486044992523796883383415767905126425555444116205847;
    
    uint256 constant IC18x = 14644964212152752513343891681404867566314696424192400660076836471382673157523;
    uint256 constant IC18y = 4584276938836096926009389412893586478513522255605211396769525495969433229367;
    
    uint256 constant IC19x = 14389715959923480229955288608191149591828775392745751958772570875207320172859;
    uint256 constant IC19y = 10621288441632317247922970182075477771843432416260425380025204641563830071794;
    
    uint256 constant IC20x = 9588895178600755726827630203091999390503544110114287120732385536994824156777;
    uint256 constant IC20y = 15864682720339479749480084867348195493533796499863280883858893653955932791998;
    
    uint256 constant IC21x = 1475663043386012935901632077293892853966040903909853001415166899960781841524;
    uint256 constant IC21y = 9025550002288489817045054578816260654557695533714112403208063497137571711780;
    
    uint256 constant IC22x = 12605565968169360240253945449521056638515987038239312203453610418811797727137;
    uint256 constant IC22y = 8944140474704190216891575897037979394933859308151499324872952139737330796273;
    
    uint256 constant IC23x = 17073322761076198568872609014142051391167319948301971443863107028596524155741;
    uint256 constant IC23y = 1077455663379575296913702418036488026046684341971352320758903792656800137371;
    
    uint256 constant IC24x = 10533266146756166996622786141592774144662904848048857358586433017735279982382;
    uint256 constant IC24y = 14935557425309571596883020868241358110746311663003759106649832517530960038914;
    
    uint256 constant IC25x = 13100015264129703230897734580820751665747216355329365770651370497678195885931;
    uint256 constant IC25y = 905761110003129034431832885694553736169980823794528571620942709327417622990;
    
    uint256 constant IC26x = 8952236332884182798604260986024974242231009361132666418595207176402190674478;
    uint256 constant IC26y = 4570798555683394758243623880160694577914179025834863899925157964196162270407;
    
    uint256 constant IC27x = 5373961311637984124207697738745975041220454301694239160953600664363839359114;
    uint256 constant IC27y = 9986716860702375732503636152226612390277799025222859173371287346998314378274;
    
    uint256 constant IC28x = 18788671395567312894203265564545350220732464375872145435639993481349044421600;
    uint256 constant IC28y = 11000147938770420214452626426039328794062559047188210569310156931955903984337;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[28] calldata _pubSignals) public view returns (bool) {
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
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
