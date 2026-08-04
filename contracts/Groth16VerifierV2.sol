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
// DEVELOPMENT VERIFIER ONLY — generated from a single-contribution dev zkey.
// NEVER deploy against real value. Production verifier is a Phase 4 output
// derived from the production multi-contributor + beacon trusted setup.
// Source zkey: artifacts/phase2/setup/aegis_v2_0000.zkey (hash-pinned in
// specs/artifact-manifest.json). nPublic = 30 (AegisProof v2).
// ============================================================================


pragma solidity >=0.7.0 <0.9.0;

contract Groth16VerifierV2 {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 15575087505370477872595732971049215894110701277670550579092027025418030133681;
    uint256 constant alphay  = 14420698255367784040190946249357679468807565886935644481458380254570522981900;
    uint256 constant betax1  = 15958492045074826878588990541743305593102176773140804365288138917072799835866;
    uint256 constant betax2  = 15335536988862574540497531343916133741232396620978223533360555473584234946057;
    uint256 constant betay1  = 16326902598890683637060745683625244269482083408076253238404476937907320556095;
    uint256 constant betay2  = 14192694113440457376331049187418965669770508406607437839236960388466743604838;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 9056104524810290714380242078490112007583862839178714418911254646365984194503;
    uint256 constant deltax2 = 11489028984890220657648252630466140523524509078061648308654184149526525517989;
    uint256 constant deltay1 = 14371150730105048755723299181323464643837442502372671271593387056086369587155;
    uint256 constant deltay2 = 4258146339782244606907971058272511746150773637361365413297101178362401633770;

    
    uint256 constant IC0x = 10151312840962491161860377162252307930675790343340332822843177239585347068593;
    uint256 constant IC0y = 575239080958806378163640917758139566957437613073502434834091958974839721019;
    
    uint256 constant IC1x = 12833544876704982205712749149543388425720032178959054517939176715900149924799;
    uint256 constant IC1y = 7391797566595382845249325550123478439422042353115190591957417130521191750143;
    
    uint256 constant IC2x = 19429325442525431929456525798173862846277518157991046432790701917498060790332;
    uint256 constant IC2y = 18466290695029855575537020632512397034955475437039203176997800961015710335143;
    
    uint256 constant IC3x = 4710159113854610392437626142768376415859728304379111515025026317465319592350;
    uint256 constant IC3y = 5399669836943503529594696106868434203336907029811535383895225180554989852543;
    
    uint256 constant IC4x = 12178419327525411206018812543620429158842897489718432097483857901198436925836;
    uint256 constant IC4y = 10778783197011072428471129278211437660644752583269130771750284956127911148971;
    
    uint256 constant IC5x = 17238325723306374928953771745347871199098922344243299936916372849481090016203;
    uint256 constant IC5y = 10033581656260750826065915518969633371679270150601155514842051475104563521838;
    
    uint256 constant IC6x = 12147948390265436150296847577146987652749510503651975886235223036843842374297;
    uint256 constant IC6y = 10506042348203270928433629291062557176217103274276303296056940907373724988492;
    
    uint256 constant IC7x = 17806007855677046324874849801859275656952507164871520133202353816747013623005;
    uint256 constant IC7y = 13952985631441069776225372658843157455209163570905410309834816999918484304042;
    
    uint256 constant IC8x = 5237607071461856045811293431472172475352997897067676590919979059891579298555;
    uint256 constant IC8y = 16694440203137667958950690334659327319516433179457797863102555303590205708791;
    
    uint256 constant IC9x = 1954932335162271244272657172877730098925190598692053035261374867971032643857;
    uint256 constant IC9y = 10121691931582667155724765515816492147074770970291213350104942211884015745364;
    
    uint256 constant IC10x = 9738131587050495825935272499790475228604865286892886653547662405029361119567;
    uint256 constant IC10y = 15677723672450365234672955452081366278909914734472621607090652159814814180375;
    
    uint256 constant IC11x = 14191565820899863826925022607645733876264915350508780599254301504775814913506;
    uint256 constant IC11y = 3627061022107527924460224477096803119182822650958283948525242065326791515029;
    
    uint256 constant IC12x = 9709215117752605535878940511419694070099247395729334899925865990980521493603;
    uint256 constant IC12y = 6169526229425540458624313420174570628442787736124920642515880011385601657755;
    
    uint256 constant IC13x = 1562181652082347693473264674055535492048542247252100432592192239604625617821;
    uint256 constant IC13y = 18478192255546575017334312419103061625541837001101852218981186892362152429296;
    
    uint256 constant IC14x = 4400702328816940708555020393486737056792137862038574304580606551635848498759;
    uint256 constant IC14y = 10626225499962206683925922523549682756019915632241753671435347222899879711263;
    
    uint256 constant IC15x = 20642972475165624499990060057813016045408595458616451085323116397217208945234;
    uint256 constant IC15y = 13754364945107176027661434526749261167862538986584853848037949859929606056220;
    
    uint256 constant IC16x = 2394667680959828178320381422236000715328929490296435361239791657691568177304;
    uint256 constant IC16y = 5764818817309986955398467536454468547017254156545091079940459243947492659540;
    
    uint256 constant IC17x = 20153660761650200476922044013655065099145938529607059638706464535278411824501;
    uint256 constant IC17y = 14183920541040219228102513971423884041256511006990408893387955845402321618761;
    
    uint256 constant IC18x = 20420760511999149356335059787683426690738250144300427306602688682417769741560;
    uint256 constant IC18y = 3259983169690498936141487867027441008577086139816353488214072117254698717533;
    
    uint256 constant IC19x = 21750304199002368900803441916778583070276023698554130709969581928646691633189;
    uint256 constant IC19y = 10745223926466139940317471113099226128471266118596646489493355919845189670364;
    
    uint256 constant IC20x = 10350201045818228854122218356605701372734665550955185209601549623296294428481;
    uint256 constant IC20y = 8845709138098450340837646258057476678020204117198371863111030841142158163008;
    
    uint256 constant IC21x = 20668533044397581607591483761994046895027570394787599378200593489370809753810;
    uint256 constant IC21y = 16442055439225931988872707832103764010848324059939161952799732192294657658063;
    
    uint256 constant IC22x = 13142539278657898415956834075901304119616129705921405206805897305339326255807;
    uint256 constant IC22y = 20416038587465397351417639472151881191957143282110312948687271216878259925281;
    
    uint256 constant IC23x = 7902451558935234914654378468604036080727954804537388821304233879820519972900;
    uint256 constant IC23y = 15541392312805351741093684380436405118893434894809786631021734211931003732904;
    
    uint256 constant IC24x = 14193105190281091669098889203273642095197306653297881232431217656808102542083;
    uint256 constant IC24y = 20165489832742288956486704312394189731158023693121236193509577271383963216177;
    
    uint256 constant IC25x = 18606088411618032140938663193285713626408688482880850208321943841527577948405;
    uint256 constant IC25y = 13477427316704375063660250250738692588087179091508726652854932306519004015011;
    
    uint256 constant IC26x = 7221846056917540006658705058743562738779864852055971397580811190654309130983;
    uint256 constant IC26y = 3106147256430018937645761310333706556689369182745510224669543204699267994657;
    
    uint256 constant IC27x = 13772769033440182700385203636979457848704929341308037803520170964264181185796;
    uint256 constant IC27y = 16351306901552401364422847473247980874980788693896802658352650382296030515439;
    
    uint256 constant IC28x = 10367388114499299352580480138107419675733309820765825458187532388774745863535;
    uint256 constant IC28y = 18523962274911214856921898604118725936168610871398818504734176183092975276452;
    
    uint256 constant IC29x = 4890205364832253951900757384634952486184579603625607194582742060874244285049;
    uint256 constant IC29y = 10616181146281199462024459185817961820839637285345743792492656771485944771359;
    
    uint256 constant IC30x = 2497612554429690749904272996938840336885929470940467765123645768102000317802;
    uint256 constant IC30y = 20940091022839688250943631920558041580927444746200477624777212790992063697738;
    
 
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
