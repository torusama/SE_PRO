package pa04

import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.RequestObject
import com.kms.katalon.core.testobject.ResponseObject
import com.kms.katalon.core.testobject.TestObjectProperty
import com.kms.katalon.core.testobject.impl.HttpTextBodyContent
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import internal.GlobalVariable

class ApiTestHelper {
    static ResponseObject send(String method, String path, Object body = null, String token = null) {
        RequestObject request = new RequestObject("${method} ${path}")
        request.setRestUrl(GlobalVariable.baseUrl + path)
        request.setRestRequestMethod(method)
        List<TestObjectProperty> headers = [
            new TestObjectProperty('Accept', ConditionType.EQUALS, 'application/json')
        ]
        if (token) {
            headers.add(new TestObjectProperty('Authorization', ConditionType.EQUALS, "Bearer ${token}"))
        }
        if (body != null) {
            headers.add(new TestObjectProperty('Content-Type', ConditionType.EQUALS, 'application/json'))
            request.setBodyContent(new HttpTextBodyContent(JsonOutput.toJson(body), 'UTF-8', 'application/json'))
        }
        request.setHttpHeaderProperties(headers)
        return WS.sendRequest(request)
    }

    static Map json(ResponseObject response) {
        return (Map) new JsonSlurper().parseText(response.getResponseBodyContent())
    }

    static String login(String email, String password = '123456') {
        ResponseObject response = send('POST', '/auth/login', [email: email, password: password])
        WS.verifyResponseStatusCode(response, 201)
        Map payload = json(response)
        assert payload.success == true
        assert payload.data?.accessToken
        return payload.data.accessToken as String
    }
}
