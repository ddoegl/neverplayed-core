To run the invitation from the Firebase Functions shell, first start the shell
in your functions directory:

```bash
cd /Users/ddoegl/speckit/neverplayed/functions
firebase functions:shell
```

Then, once the shell is ready, run this command (note the data wrapper which is
required for onCall functions):

```javascript
sendInvitation({ data: { targetEmail: "[EMAIL_ADDRESS]" } });
```
