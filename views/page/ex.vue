<template>
            <div class="mdiv">
                <div class="inputDiv">
                    <div class="label">Name:</div>
                    <input class="input" type="text" v-model="info.name">
                </div>
                <div class="inputDiv">
                    <div class="label">Version name: </div>
                    <input class="input" type="text" v-model="info.versionName">
                </div>
                <div class="inputDiv">
                    <div class="label">Endpoint: </div>
                    <input class="input" type="text" v-model="info.endpoint">
                </div>
                <div class="inputDiv">
                    <div class="label">Is Enabled: </div>
                    <input class="input" type="checkbox" v-model="info.isEabled">
                </div>
                <h2>Parameters:</h2>
                <div class="parametres">
                    <div class="parametr" v-for="(el, i) in info.params" :key="i">\
                        <div class="sminputDiv">
                            <div class="label">Name:</div>
                            <input class="input" type="text" v-model="el.name">
                        </div>
                        <div class="sminputDiv">
                            <div class="label">Type:</div>
                            <select v-model="el.type">
                                <option disabled>Выберите героя</option>
                                <option value="Integer">Integer</option>
                                <option value="Number">Number</option>
                                <option value="String">String</option>
                            </select>
                        </div>
                        <div class="sminputDiv">
                            <div class="label">Required:</div>
                            <input class="input" type="checkbox" v-model="el.required">
                        </div>
                        <hr/>
                    </div>
                    <div class="smbut" style="background-color: grey" @click="addParam">Add parameter</div>
                    <div class="smbut" style="background-color: red" @click="removeParam">Remove parameter</div>
                </div>
                <h2>SQL query:</h2>
                <div style="font-size: 0.8em">Example: SELECT name from someTable where id = #{parameterName}</div>
                <div class="sqlQuery">
                    <div class="inputDiv">
                        <div class="label">Query: </div>
                        <textarea class="input" type="text" v-model="info.sqlQuery">
                    </div>
                </div>
            </div>
</template>